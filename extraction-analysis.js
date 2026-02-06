const fs = require('fs');
const path = require('path');
const extract = require('extract-zip');

async function analyzeProjects() {
  try {
    // Extract Eaglercraft
    console.log('Extracting Eaglercraft 1.12...');
    await extract(path.join(__dirname, 'Eaglercraft_1.12_Offline_en_US_SOURCE-main.zip'), {
      dir: path.join(__dirname, 'extracted/eaglercraft')
    });

    // Extract Meteor Client
    console.log('Extracting Meteor Client...');
    await extract(path.join(__dirname, 'meteor-client-master.zip'), {
      dir: path.join(__dirname, 'extracted/meteor')
    });

    console.log('Extraction complete!');

    // Analyze Eaglercraft structure
    const eaglercraftFiles = getAllFiles(path.join(__dirname, 'extracted/eaglercraft'));
    console.log('\n=== EAGLERCRAFT STRUCTURE ===');
    console.log(`Total files: ${eaglercraftFiles.length}`);
    
    // Find key files
    const javaFiles = eaglercraftFiles.filter(f => f.endsWith('.java'));
    const gradleFiles = eaglercraftFiles.filter(f => f.includes('build.gradle') || f.includes('settings.gradle'));
    const jsFiles = eaglercraftFiles.filter(f => f.endsWith('.js'));
    
    console.log(`Java files: ${javaFiles.length}`);
    console.log(`Gradle files: ${gradleFiles.length}`);
    console.log(`JavaScript files: ${jsFiles.length}`);
    console.log(`Gradle files found:`, gradleFiles);

    // Analyze Meteor structure
    const meteorFiles = getAllFiles(path.join(__dirname, 'extracted/meteor'));
    console.log('\n=== METEOR CLIENT STRUCTURE ===');
    console.log(`Total files: ${meteorFiles.length}`);
    
    const meteorJavaFiles = meteorFiles.filter(f => f.endsWith('.java'));
    const meteorModules = meteorJavaFiles.filter(f => f.includes('/modules/'));
    console.log(`Java files: ${meteorJavaFiles.length}`);
    console.log(`Module files: ${meteorModules.length}`);
    console.log(`Sample modules:`, meteorModules.slice(0, 20));

  } catch (error) {
    console.error('Error:', error);
  }
}

function getAllFiles(dir) {
  let results = [];
  try {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        results = results.concat(getAllFiles(filePath));
      } else {
        results.push(filePath);
      }
    });
  } catch (e) {
    // Directory might not exist yet
  }
  return results;
}

analyzeProjects();