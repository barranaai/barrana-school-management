// Test script to debug the update report functionality
const fs = require('fs');

console.log('=== Debugging AllReports.tsx Edit Report Functionality ===\n');

// Read AllReports.tsx and check the implementation
const allReportsContent = fs.readFileSync('./src/components/admin/sections/AllReports.tsx', 'utf8');

// Find potential issues in the edit report implementation
const lines = allReportsContent.split('\n');

// Check if the edit button is properly configured
const editButtonLines = lines.filter((line, idx) => {
  return line.includes('handleEditReport') || 
         line.includes('canEditReport') ||
         line.includes('Edit Report');
});

console.log('=== Edit Button Implementation ===');
editButtonLines.forEach(line => console.log(line.trim()));

// Check the canEditReport function
const canEditStart = lines.findIndex(line => line.includes('canEditReport = (report'));
const canEditEnd = lines.findIndex((line, idx) => idx > canEditStart && line.includes('};'));

console.log('\n=== canEditReport Function ===');
console.log(lines.slice(canEditStart, canEditEnd + 1).join('\n'));

// Check handleEditReport function
const handleEditStart = lines.findIndex(line => line.includes('handleEditReport = (report'));
const handleEditEnd = lines.findIndex((line, idx) => idx > handleEditStart && line.includes('};'));

console.log('\n=== handleEditReport Function ===');
console.log(lines.slice(handleEditStart, handleEditEnd + 1).join('\n'));

// Check if the API service is imported
const apiServiceImport = lines.find(line => line.includes('apiService') && line.includes('import'));
console.log('\n=== API Service Import ===');
console.log(apiServiceImport || 'Not found');

// Check the edit dialog render
const editDialogStart = lines.findIndex(line => line.includes('Edit Report Dialog'));
const editDialogEnd = lines.findIndex((line, idx) => idx > editDialogStart && line.includes('</Dialog>'));

console.log('\n=== Edit Dialog Structure ===');
console.log('Start line:', editDialogStart);
console.log('End line:', editDialogEnd);
console.log('Dialog exists:', editDialogStart !== -1 && editDialogEnd !== -1);
