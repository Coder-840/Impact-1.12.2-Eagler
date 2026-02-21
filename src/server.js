import { execFile } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import AdmZip from 'adm-zip';
import archiver from 'archiver';
import express from 'express';
import multer from 'multer';

const execFileAsync = promisify(execFile);
const app = express();
const upload = multer({ dest: os.tmpdir() });

const PORT = Number(process.env.PORT || 3000);
const TEAVM_VERSION = process.env.TEAVM_VERSION || '0.10.0';

app.get('/', (_req, res) => {
  res.json({
    service: 'teavm-translator',
    endpoints: {
      health: 'GET /health',
      translate: 'POST /translate (multipart/form-data: archive, mainClass, target[js|wasm], classPath?)'
    }
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/translate', upload.single('archive'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Missing "archive" ZIP upload.' });
  }

  const mainClass = req.body.mainClass;
  const target = (req.body.target || 'js').toLowerCase();
  const classPath = req.body.classPath || 'src/main/java';

  if (!mainClass) {
    await safeUnlink(req.file.path);
    return res.status(400).json({ error: 'Missing "mainClass" form field (e.g. com.example.Main).' });
  }

  if (!['js', 'wasm'].includes(target)) {
    await safeUnlink(req.file.path);
    return res.status(400).json({ error: '"target" must be one of: js, wasm' });
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'teavm-job-'));
  const sourceDir = path.join(tempRoot, 'project');
  const outputDir = path.join(tempRoot, 'output');

  try {
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    const zip = new AdmZip(req.file.path);
    zip.extractAllTo(sourceDir, true);

    const pomPath = path.join(tempRoot, 'pom.xml');
    const outputFile = target === 'js' ? 'app.js' : 'app.wasm';

    await fs.writeFile(
      pomPath,
      buildPom({ teavmVersion: TEAVM_VERSION, mainClass, classPath, target, outputDir, outputFile }),
      'utf8'
    );

    await execFileAsync(
      'mvn',
      ['-B', '-q', '-f', pomPath, 'package'],
      {
        cwd: tempRoot,
        timeout: 10 * 60 * 1000,
        maxBuffer: 20 * 1024 * 1024
      }
    );

    const translatedPath = path.join(outputDir, outputFile);
    await fs.access(translatedPath);

    const archiveName = `translated-${target}.zip`;
    const responsePath = path.join(tempRoot, archiveName);
    await zipDirectory(outputDir, responsePath);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);
    createReadStream(responsePath).pipe(res);
  } catch (error) {
    res.status(500).json({
      error: 'TeaVM translation failed.',
      details: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await safeUnlink(req.file.path);
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`TeaVM translator listening on :${PORT}`);
});

function buildPom({ teavmVersion, mainClass, classPath, target, outputDir, outputFile }) {
  const teavmTarget = target === 'js' ? 'JAVASCRIPT' : 'WEBASSEMBLY';

  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>app.teavm</groupId>
  <artifactId>translator-job</artifactId>
  <version>1.0.0</version>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.13.0</version>
        <configuration>
          <release>17</release>
        </configuration>
      </plugin>
      <plugin>
        <groupId>org.teavm</groupId>
        <artifactId>teavm-maven-plugin</artifactId>
        <version>${teavmVersion}</version>
        <executions>
          <execution>
            <phase>package</phase>
            <goals>
              <goal>compile</goal>
            </goals>
            <configuration>
              <mainClass>${mainClass}</mainClass>
              <targetType>${teavmTarget}</targetType>
              <sourceFilesCopied>false</sourceFilesCopied>
              <debugInformationGenerated>false</debugInformationGenerated>
              <targetDirectory>${outputDir}</targetDirectory>
              <targetFileName>${outputFile}</targetFileName>
              <classesToPreserve>
                <param>${mainClass}</param>
              </classesToPreserve>
            </configuration>
          </execution>
        </executions>
      </plugin>
    </plugins>
    <sourceDirectory>${classPath}</sourceDirectory>
  </build>
</project>
`;
}

async function safeUnlink(filePath) {
  try {
    await fs.unlink(filePath);
  } catch {
    // no-op
  }
}

async function zipDirectory(sourceDir, outFile) {
  await new Promise((resolve, reject) => {
    const out = createWriteStream(outFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    out.on('close', resolve);
    out.on('error', reject);
    archive.on('error', reject);

    archive.pipe(out);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
