// MongoDB initialization script for Docker container
// This script runs when the MongoDB container starts for the first time

// Switch to the barrana_school database
db = db.getSiblingDB('barrana_school');

// Create an admin user for the application database
db.createUser({
  user: 'barrana_admin',
  pwd: 'barrana_password_123',
  roles: [
    {
      role: 'readWrite',
      db: 'barrana_school'
    }
  ]
});

// Create indexes for better performance
print('Creating indexes...');

// Users collection indexes
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "role": 1 });
db.users.createIndex({ "schoolId": 1 });
db.users.createIndex({ "firstName": 1, "lastName": 1 });

// Schools collection indexes
db.schools.createIndex({ "name": 1 });
db.schools.createIndex({ "createdAt": 1 });

// Students collection indexes
db.students.createIndex({ "firstName": 1, "lastName": 1 });
db.students.createIndex({ "schoolId": 1 });
db.students.createIndex({ "grade": 1 });
db.students.createIndex({ "teacherId": 1 });
db.students.createIndex({ "parentEmail": 1 });

// Teachers collection indexes
db.teachers.createIndex({ "schoolId": 1 });
db.teachers.createIndex({ "email": 1 }, { unique: true });

// Classes collection indexes
db.classes.createIndex({ "schoolId": 1 });
db.classes.createIndex({ "grade": 1 });
db.classes.createIndex({ "assignedTeachers.teacherId": 1 });

// Reports collection indexes
db.reports.createIndex({ "studentId": 1 });
db.reports.createIndex({ "teacherId": 1 });
db.reports.createIndex({ "schoolId": 1 });
db.reports.createIndex({ "status": 1 });
db.reports.createIndex({ "createdAt": 1 });
db.reports.createIndex({ "templateId": 1 });

// Report Templates collection indexes
db.reporttemplates.createIndex({ "schoolId": 1 });
db.reporttemplates.createIndex({ "grade": 1 });
db.reporttemplates.createIndex({ "reportFrequency": 1 });
db.reporttemplates.createIndex({ "isActive": 1 });

// Communications collection indexes
db.communications.createIndex({ "schoolId": 1 });
db.communications.createIndex({ "type": 1 });
db.communications.createIndex({ "createdAt": 1 });

print('Database initialization completed successfully!');
print('Created database: barrana_school');
print('Created user: barrana_admin');
print('Created indexes for all collections');
