// frontend/src/app/components/SQLPractice.tsx
// Redesigned SQL Practice — question-first, editor-second
// No schema selector clutter. Students see a question, write SQL, see results.

"use client";

import { useEffect, useRef, useState } from "react";

// ── Questions with embedded schema ───────────────────────────────────────────

const QUESTIONS = [
  {
    id: 1,
    difficulty: "Easy",
    topic: "SELECT + WHERE",
    question: "Find all students from the CSE branch with a CGPA above 8.0. Show their name and CGPA, sorted by CGPA descending.",
    hint: "Use WHERE with two conditions joined by AND. ORDER BY with DESC.",
    answer: "SELECT name, cgpa\nFROM students\nWHERE branch = 'CSE' AND cgpa > 8.0\nORDER BY cgpa DESC;",
    explanation: "Two conditions on the same row — AND combines them. DESC gives highest first.",
    schema: `
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, branch TEXT, cgpa REAL, year INTEGER);
INSERT INTO students VALUES
(1,'Rahul Kumar','CSE',8.5,3),(2,'Priya Singh','ECE',7.8,3),
(3,'Amit Sharma','IT',9.1,4),(4,'Sneha Patel','CSE',6.5,2),
(5,'Rohit Verma','MECH',7.2,4),(6,'Anita Joshi','CSE',8.9,3),
(7,'Karan Mehta','CSE',8.2,2),(8,'Divya Nair','CSE',7.5,3);`,
  },
  {
    id: 2,
    difficulty: "Easy",
    topic: "GROUP BY + COUNT",
    question: "How many students are there in each branch? Show the branch name and student count, ordered by count descending.",
    hint: "GROUP BY branch, use COUNT(*) to count rows per group.",
    answer: "SELECT branch, COUNT(*) AS student_count\nFROM students\nGROUP BY branch\nORDER BY student_count DESC;",
    explanation: "GROUP BY collapses rows with the same branch value. COUNT(*) counts rows in each group.",
    schema: `
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, branch TEXT, cgpa REAL, year INTEGER);
INSERT INTO students VALUES
(1,'Rahul Kumar','CSE',8.5,3),(2,'Priya Singh','ECE',7.8,3),
(3,'Amit Sharma','IT',9.1,4),(4,'Sneha Patel','CSE',6.5,2),
(5,'Rohit Verma','MECH',7.2,4),(6,'Anita Joshi','CSE',8.9,3),
(7,'Karan Mehta','CSE',8.2,2),(8,'Divya Nair','ECE',7.5,3);`,
  },
  {
    id: 3,
    difficulty: "Easy",
    topic: "INNER JOIN",
    question: "List each employee's name along with their department name. Only show employees who belong to a department.",
    hint: "INNER JOIN employees with departments on the foreign key.",
    answer: "SELECT e.name AS employee, d.name AS department\nFROM employees e\nINNER JOIN departments d ON e.dept_id = d.id\nORDER BY d.name, e.name;",
    explanation: "INNER JOIN returns only rows where the join condition matches in both tables. Employees without a department are excluded.",
    schema: `
CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT, location TEXT);
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary REAL, manager_id INTEGER);
INSERT INTO departments VALUES (1,'Engineering','Bangalore'),(2,'Marketing','Mumbai'),(3,'HR','Delhi'),(4,'Finance','Pune');
INSERT INTO employees VALUES
(1,'Sunita Rao',1,95000,NULL),(2,'Kiran Mehta',1,72000,1),(3,'Deepak Nair',1,68000,1),
(4,'Pooja Shah',2,55000,NULL),(5,'Amit Das',2,48000,4),(6,'Rekha Iyer',3,60000,NULL),
(7,'Vijay Kumar',1,82000,1),(8,'Meena Pillai',4,90000,NULL);`,
  },
  {
    id: 4,
    difficulty: "Easy",
    topic: "LEFT JOIN",
    question: "List all departments and the number of employees in each. Include departments with zero employees.",
    hint: "LEFT JOIN keeps all rows from the left table (departments) even when there's no match.",
    answer: "SELECT d.name AS department, COUNT(e.id) AS employee_count\nFROM departments d\nLEFT JOIN employees e ON d.id = e.dept_id\nGROUP BY d.id\nORDER BY employee_count DESC;",
    explanation: "LEFT JOIN includes all departments. COUNT(e.id) counts non-NULL employee IDs — returns 0 for departments with no employees.",
    schema: `
CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT, location TEXT);
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary REAL);
INSERT INTO departments VALUES (1,'Engineering','Bangalore'),(2,'Marketing','Mumbai'),(3,'HR','Delhi'),(4,'Finance','Pune'),(5,'Legal','Chennai');
INSERT INTO employees VALUES
(1,'Sunita Rao',1,95000),(2,'Kiran Mehta',1,72000),(3,'Deepak Nair',1,68000),
(4,'Pooja Shah',2,55000),(5,'Amit Das',2,48000),(6,'Rekha Iyer',3,60000);`,
  },
  {
    id: 5,
    difficulty: "Medium",
    topic: "Subquery",
    question: "Find all employees who earn more than the average salary across the entire company.",
    hint: "Use a subquery in WHERE: WHERE salary > (SELECT AVG(salary) FROM employees)",
    answer: "SELECT name, salary\nFROM employees\nWHERE salary > (SELECT AVG(salary) FROM employees)\nORDER BY salary DESC;",
    explanation: "The subquery runs first and returns a single value (the average). The outer query then compares each row's salary to that value.",
    schema: `
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary REAL);
INSERT INTO employees VALUES
(1,'Sunita Rao',1,95000),(2,'Kiran Mehta',1,72000),(3,'Deepak Nair',1,68000),
(4,'Pooja Shah',2,55000),(5,'Amit Das',2,48000),(6,'Rekha Iyer',3,60000),
(7,'Vijay Kumar',1,82000),(8,'Meena Pillai',4,90000);`,
  },
  {
    id: 6,
    difficulty: "Medium",
    topic: "Self JOIN",
    question: "Find all employees who earn more than their direct manager.",
    hint: "JOIN the employees table to itself: employees e JOIN employees m ON e.manager_id = m.id",
    answer: "SELECT e.name AS employee, e.salary AS emp_salary,\n       m.name AS manager, m.salary AS mgr_salary\nFROM employees e\nJOIN employees m ON e.manager_id = m.id\nWHERE e.salary > m.salary;",
    explanation: "A self-join treats the same table as two separate tables — one for employees (e), one for managers (m). The WHERE filters to only cases where the employee earns more.",
    schema: `
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, salary REAL, manager_id INTEGER);
INSERT INTO employees VALUES
(1,'Sunita Rao',95000,NULL),(2,'Kiran Mehta',72000,1),(3,'Deepak Nair',98000,1),
(4,'Pooja Shah',55000,NULL),(5,'Amit Das',60000,4),(6,'Rekha Iyer',60000,NULL),
(7,'Vijay Kumar',82000,1),(8,'Meena Pillai',50000,6);`,
  },
  {
    id: 7,
    difficulty: "Medium",
    topic: "HAVING",
    question: "Find departments where the average salary is above 65,000. Show the department ID and average salary.",
    hint: "HAVING filters groups after GROUP BY — you cannot use WHERE on aggregate functions.",
    answer: "SELECT dept_id, ROUND(AVG(salary), 2) AS avg_salary\nFROM employees\nGROUP BY dept_id\nHAVING AVG(salary) > 65000\nORDER BY avg_salary DESC;",
    explanation: "WHERE filters individual rows before grouping. HAVING filters groups after aggregation. AVG(salary) in HAVING refers to the average per group.",
    schema: `
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary REAL);
INSERT INTO employees VALUES
(1,'Sunita Rao',1,95000),(2,'Kiran Mehta',1,72000),(3,'Deepak Nair',1,68000),
(4,'Pooja Shah',2,55000),(5,'Amit Das',2,48000),(6,'Rekha Iyer',3,60000),
(7,'Vijay Kumar',1,82000),(8,'Meena Pillai',4,90000),(9,'Ravi Sharma',3,58000);`,
  },
  {
    id: 8,
    difficulty: "Medium",
    topic: "NOT EXISTS",
    question: "Find all students who are not enrolled in any course.",
    hint: "Use NOT EXISTS with a correlated subquery, or LEFT JOIN with IS NULL check.",
    answer: "SELECT s.name\nFROM students s\nWHERE NOT EXISTS (\n  SELECT 1 FROM enrollments e\n  WHERE e.student_id = s.id\n);",
    explanation: "NOT EXISTS returns true when the subquery returns no rows. The subquery is correlated — it references the outer query's s.id for each student row.",
    schema: `
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, branch TEXT);
CREATE TABLE enrollments (student_id INTEGER, course_id INTEGER, PRIMARY KEY(student_id, course_id));
INSERT INTO students VALUES (1,'Rahul','CSE'),(2,'Priya','ECE'),(3,'Amit','IT'),(4,'Sneha','CSE'),(5,'Rohit','MECH');
INSERT INTO enrollments VALUES (1,101),(1,102),(2,101),(3,103);`,
  },
  {
    id: 9,
    difficulty: "Hard",
    topic: "Correlated Subquery",
    question: "For each department, find the employee with the highest salary. Show department name, employee name, and salary.",
    hint: "Correlated subquery: WHERE e.salary = (SELECT MAX(salary) FROM employees WHERE dept_id = e.dept_id)",
    answer: "SELECT d.name AS department, e.name AS top_earner, e.salary\nFROM employees e\nJOIN departments d ON e.dept_id = d.id\nWHERE e.salary = (\n  SELECT MAX(salary)\n  FROM employees e2\n  WHERE e2.dept_id = e.dept_id\n)\nORDER BY e.salary DESC;",
    explanation: "The correlated subquery runs once per row in the outer query, finding the max salary for that specific department. If two employees tie for max, both are returned.",
    schema: `
CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary REAL);
INSERT INTO departments VALUES (1,'Engineering'),(2,'Marketing'),(3,'HR'),(4,'Finance');
INSERT INTO employees VALUES
(1,'Sunita Rao',1,95000),(2,'Kiran Mehta',1,72000),(3,'Deepak Nair',1,68000),
(4,'Pooja Shah',2,55000),(5,'Amit Das',2,62000),(6,'Rekha Iyer',3,60000),
(7,'Vijay Kumar',1,82000),(8,'Meena Pillai',4,90000),(9,'Ravi Sharma',3,58000);`,
  },
  {
    id: 10,
    difficulty: "Hard",
    topic: "Multiple JOINs",
    question: "List each student's name, the courses they're enrolled in, and their grade. Only show students who have at least one grade of 'A'.",
    hint: "JOIN three tables, then filter using a subquery or HAVING to keep only students with at least one A.",
    answer: "SELECT s.name, c.name AS course, e.grade\nFROM students s\nJOIN enrollments e ON s.id = e.student_id\nJOIN courses c ON e.course_id = c.id\nWHERE s.id IN (\n  SELECT student_id FROM enrollments WHERE grade = 'A'\n)\nORDER BY s.name, c.name;",
    explanation: "The subquery finds all student_ids who have at least one A. The main query then shows all enrollments for those students — not just the A grades.",
    schema: `
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, branch TEXT);
CREATE TABLE courses (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE enrollments (student_id INTEGER, course_id INTEGER, grade TEXT, PRIMARY KEY(student_id, course_id));
INSERT INTO students VALUES (1,'Rahul','CSE'),(2,'Priya','ECE'),(3,'Amit','IT'),(4,'Sneha','CSE');
INSERT INTO courses VALUES (101,'DBMS'),(102,'OS'),(103,'Networks'),(104,'OOP');
INSERT INTO enrollments VALUES
(1,101,'A'),(1,102,'B'),(1,103,'A'),(2,101,'B'),(2,104,'C'),
(3,101,'A'),(3,102,'A'),(4,102,'C'),(4,103,'B');`,
  },
  {
    id: 11,
    difficulty: "Easy",
    topic: "SELECT + WHERE",
    question: "Find all students from the CSE branch who have a CGPA above 8.0. Show their name and CGPA, sorted by CGPA descending.",
    hint: "Use WHERE with two conditions joined by AND. ORDER BY column DESC gives highest values first.",
    answer: "SELECT name, cgpa\nFROM students\nWHERE branch = 'CSE' AND cgpa > 8.0\nORDER BY cgpa DESC;",
    explanation: "AND requires both conditions to be true for a row to appear in the result. DESC reverses the default ascending sort order.",
    schema: `
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT,
  branch TEXT,
  cgpa REAL,
  year INTEGER
);
INSERT INTO students VALUES
(1,'Rahul Kumar','CSE',8.5,3),
(2,'Priya Singh','ECE',7.8,3),
(3,'Amit Sharma','CSE',9.1,4),
(4,'Neha Gupta','IT',8.7,2),
(5,'Vikram Rao','CSE',7.5,1),
(6,'Divya Nair','CSE',8.9,4),
(7,'Rohan Mehta','ECE',9.2,3),
(8,'Ananya Iyer','CSE',6.8,2);`,
  },
  {
    id: 12,
    difficulty: "Easy",
    topic: "ORDER BY + LIMIT",
    question: "List the top 3 highest-paid employees from the employees table. Show their name and salary.",
    hint: "Sort by salary in descending order, then restrict the number of rows returned with LIMIT.",
    answer: "SELECT name, salary\nFROM employees\nORDER BY salary DESC\nLIMIT 3;",
    explanation: "LIMIT n returns only the first n rows of the result set after all sorting has been applied, making it ideal for top-N queries.",
    schema: `
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT,
  department TEXT,
  salary REAL,
  join_year INTEGER
);
INSERT INTO employees VALUES
(1,'Suresh Babu','Engineering',95000,2019),
(2,'Meena Pillai','HR',62000,2020),
(3,'Arjun Desai','Engineering',120000,2017),
(4,'Kavitha Reddy','Finance',78000,2018),
(5,'Nikhil Joshi','Engineering',105000,2016),
(6,'Pooja Shetty','Marketing',69000,2021),
(7,'Kiran Naik','Finance',85000,2015),
(8,'Lakshmi Rao','HR',58000,2022);`,
  },
  {
    id: 13,
    difficulty: "Easy",
    topic: "DISTINCT",
    question: "Find all unique branches (departments) that appear in the students table. Show each branch name only once, sorted alphabetically.",
    hint: "DISTINCT removes duplicate values from a column in the result. Combine it with ORDER BY for alphabetical output.",
    answer: "SELECT DISTINCT branch\nFROM students\nORDER BY branch;",
    explanation: "DISTINCT tells the database to return only one row for each unique value of the specified column, eliminating duplicates from the result set.",
    schema: `
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT,
  branch TEXT,
  cgpa REAL,
  year INTEGER
);
INSERT INTO students VALUES
(1,'Rahul Kumar','CSE',8.5,3),
(2,'Priya Singh','ECE',7.8,3),
(3,'Amit Sharma','IT',9.1,4),
(4,'Neha Gupta','IT',8.7,2),
(5,'Vikram Rao','CSE',7.5,1),
(6,'Divya Nair','ME',8.2,4),
(7,'Rohan Mehta','ECE',9.2,3),
(8,'Ananya Iyer','CSE',6.8,2);`,
  },
  {
    id: 14,
    difficulty: "Easy",
    topic: "Aggregation (COUNT + AVG)",
    question: "For each department in the employees table, show the number of employees and the average salary. Label the columns as emp_count and avg_salary.",
    hint: "GROUP BY department groups the rows. Use COUNT(*) and AVG(salary) as aggregate functions on each group.",
    answer: "SELECT department,\n       COUNT(*) AS emp_count,\n       AVG(salary) AS avg_salary\nFROM employees\nGROUP BY department;",
    explanation: "GROUP BY collapses all rows with the same department value into a single result row, and aggregate functions like COUNT and AVG operate on each group independently.",
    schema: `
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT,
  department TEXT,
  salary REAL,
  join_year INTEGER
);
INSERT INTO employees VALUES
(1,'Suresh Babu','Engineering',95000,2019),
(2,'Meena Pillai','HR',62000,2020),
(3,'Arjun Desai','Engineering',120000,2017),
(4,'Kavitha Reddy','Finance',78000,2018),
(5,'Nikhil Joshi','Engineering',105000,2016),
(6,'Pooja Shetty','Marketing',69000,2021),
(7,'Kiran Naik','Finance',85000,2015),
(8,'Lakshmi Rao','HR',58000,2022);`,
  },
  {
    id: 15,
    difficulty: "Easy",
    topic: "LIKE Pattern Matching",
    question: "Find all customers whose name starts with the letter 'A'. Show their name and city.",
    hint: "Use the LIKE operator with a wildcard character. The percent sign % matches any sequence of characters.",
    answer: "SELECT name, city\nFROM customers\nWHERE name LIKE 'A%';",
    explanation: "LIKE performs pattern matching in text columns. The pattern 'A%' matches any string that begins with A followed by any characters, while '%A%' would match A anywhere in the string.",
    schema: `
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  city TEXT,
  email TEXT,
  registration_date TEXT
);
INSERT INTO customers VALUES
(1,'Aarav Patel','Mumbai','aarav@email.com','2023-01-15'),
(2,'Bhavna Shah','Delhi','bhavna@email.com','2023-02-20'),
(3,'Anita Kulkarni','Pune','anita@email.com','2023-03-10'),
(4,'Deepak Verma','Chennai','deepak@email.com','2023-03-25'),
(5,'Aishwarya Rao','Bangalore','aish@email.com','2023-04-05'),
(6,'Farhan Qureshi','Hyderabad','farhan@email.com','2023-05-12'),
(7,'Geeta Nair','Kochi','geeta@email.com','2023-06-01'),
(8,'Alok Sharma','Jaipur','alok@email.com','2023-06-18');`,
  },
  {
    id: 16,
    difficulty: "Easy",
    topic: "SUM + GROUP BY",
    question: "For each customer, find the total amount they have spent across all their orders. Show the customer_id and their total spending, sorted by total spending descending.",
    hint: "SUM(amount) with GROUP BY customer_id adds up order amounts per customer. Use ORDER BY on the aggregate result.",
    answer: "SELECT customer_id,\n       SUM(amount) AS total_spent\nFROM orders\nGROUP BY customer_id\nORDER BY total_spent DESC;",
    explanation: "SUM is an aggregate function that adds all values in a column within each group defined by GROUP BY. Aliasing the result with AS lets you reference it in ORDER BY.",
    schema: `
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER,
  product TEXT,
  amount REAL,
  order_date TEXT
);
INSERT INTO orders VALUES
(1,101,'Laptop',45000,'2024-01-10'),
(2,102,'Phone',18000,'2024-01-15'),
(3,101,'Mouse',1200,'2024-01-20'),
(4,103,'Keyboard',2500,'2024-02-01'),
(5,102,'Headphones',3500,'2024-02-10'),
(6,104,'Monitor',22000,'2024-02-15'),
(7,101,'Webcam',4000,'2024-03-01'),
(8,103,'USB Hub',1800,'2024-03-05'),
(9,104,'Laptop',47000,'2024-03-10'),
(10,102,'Tablet',28000,'2024-03-20');`,
  },
  {
    id: 17,
    difficulty: "Medium",
    topic: "INNER JOIN",
    question: "Show the name of each student and the name of the courses they are enrolled in. Only include students who are actually enrolled in at least one course.",
    hint: "You need to join three tables: students, enrollments, and courses. An INNER JOIN on matching keys will only return rows where a match exists in both tables.",
    answer: "SELECT s.name AS student_name,\n       c.course_name\nFROM students s\nINNER JOIN enrollments e ON s.id = e.student_id\nINNER JOIN courses c ON e.course_id = c.id;",
    explanation: "INNER JOIN returns only the rows where the join condition is satisfied in both tables. Chaining two JOINs bridges the many-to-many relationship through the enrollments junction table.",
    schema: `
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT,
  branch TEXT,
  cgpa REAL
);
CREATE TABLE courses (
  id INTEGER PRIMARY KEY,
  course_name TEXT,
  credits INTEGER
);
CREATE TABLE enrollments (
  id INTEGER PRIMARY KEY,
  student_id INTEGER,
  course_id INTEGER,
  grade TEXT
);
INSERT INTO students VALUES
(1,'Rahul Kumar','CSE',8.5),
(2,'Priya Singh','ECE',7.8),
(3,'Amit Sharma','IT',9.1),
(4,'Neha Gupta','CSE',8.7),
(5,'Vikram Rao','ECE',7.2);
INSERT INTO courses VALUES
(1,'Data Structures',4),
(2,'Database Systems',3),
(3,'Computer Networks',3),
(4,'Operating Systems',4);
INSERT INTO enrollments VALUES
(1,1,1,'A'),(2,1,2,'B'),(3,2,1,'A'),(4,2,3,'C'),
(5,3,2,'A'),(6,3,4,'A'),(7,4,1,'B'),(8,4,2,'A');`,
  },
  {
    id: 18,
    difficulty: "Medium",
    topic: "LEFT JOIN",
    question: "List all employees and the name of the project they are assigned to. Include employees who have not been assigned to any project yet, showing NULL for the project name.",
    hint: "A LEFT JOIN keeps all rows from the left table (employees) and fills in NULLs for the right table (projects) where there is no match.",
    answer: "SELECT e.name AS employee_name,\n       p.project_name\nFROM employees e\nLEFT JOIN project_assignments pa ON e.id = pa.employee_id\nLEFT JOIN projects p ON pa.project_id = p.id;",
    explanation: "LEFT JOIN preserves every row from the left table regardless of whether a matching row exists in the right table. Rows without a match get NULL in the right-table columns, making it useful for finding unassigned or unmatched records.",
    schema: `
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT,
  department TEXT,
  salary REAL
);
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  project_name TEXT,
  budget REAL
);
CREATE TABLE project_assignments (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER,
  project_id INTEGER
);
INSERT INTO employees VALUES
(1,'Suresh Babu','Engineering',95000),
(2,'Meena Pillai','HR',62000),
(3,'Arjun Desai','Engineering',120000),
(4,'Kavitha Reddy','Finance',78000),
(5,'Nikhil Joshi','Engineering',105000),
(6,'Pooja Shetty','Marketing',69000);
INSERT INTO projects VALUES
(1,'Apollo CRM',5000000),
(2,'Payroll Upgrade',1200000),
(3,'Data Migration',800000);
INSERT INTO project_assignments VALUES
(1,1,1),(2,3,1),(3,5,3),(4,2,2);`,
  },
  {
    id: 19,
    difficulty: "Medium",
    topic: "HAVING Clause",
    question: "Find all branches in the students table that have more than 2 students with a CGPA above 8.0. Show the branch name and the count of qualifying students.",
    hint: "Filter rows with WHERE before grouping, then use HAVING to filter the groups based on an aggregate condition. HAVING operates after GROUP BY.",
    answer: "SELECT branch,\n       COUNT(*) AS high_cgpa_count\nFROM students\nWHERE cgpa > 8.0\nGROUP BY branch\nHAVING COUNT(*) > 2;",
    explanation: "WHERE filters individual rows before grouping. HAVING filters entire groups after GROUP BY and aggregation - you cannot use WHERE with aggregate conditions because the groups do not exist yet at that stage.",
    schema: `
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT,
  branch TEXT,
  cgpa REAL,
  year INTEGER
);
INSERT INTO students VALUES
(1,'Rahul Kumar','CSE',8.5,3),
(2,'Priya Singh','ECE',7.8,3),
(3,'Amit Sharma','CSE',9.1,4),
(4,'Neha Gupta','IT',8.7,2),
(5,'Vikram Rao','CSE',7.5,1),
(6,'Divya Nair','CSE',8.9,4),
(7,'Rohan Mehta','ECE',9.2,3),
(8,'Ananya Iyer','IT',8.4,2),
(9,'Siddharth Rao','ECE',7.1,1),
(10,'Tanvi Bhatt','CSE',8.6,3);`,
  },
  {
    id: 20,
    difficulty: "Medium",
    topic: "Subquery",
    question: "Find all employees who earn more than the average salary of their own department. Show their name, department, and salary.",
    hint: "Write a correlated subquery that calculates the average salary for the same department as the outer row. Reference the outer table inside the subquery.",
    answer: "SELECT name, department, salary\nFROM employees e1\nWHERE salary > (\n  SELECT AVG(salary)\n  FROM employees e2\n  WHERE e2.department = e1.department\n);",
    explanation: "A correlated subquery references a column from the outer query (e1.department) and is re-executed once for each row of the outer query, allowing row-by-row comparisons against group-level aggregates.",
    schema: `
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT,
  department TEXT,
  salary REAL,
  join_year INTEGER
);
INSERT INTO employees VALUES
(1,'Suresh Babu','Engineering',95000,2019),
(2,'Meena Pillai','HR',62000,2020),
(3,'Arjun Desai','Engineering',120000,2017),
(4,'Kavitha Reddy','Finance',78000,2018),
(5,'Nikhil Joshi','Engineering',105000,2016),
(6,'Pooja Shetty','HR',72000,2021),
(7,'Kiran Naik','Finance',85000,2015),
(8,'Lakshmi Rao','HR',58000,2022),
(9,'Deepak Menon','Finance',91000,2014);`,
  },
  {
    id: 21,
    difficulty: "Medium",
    topic: "CASE WHEN",
    question: "For each student, classify their performance as 'Distinction' (CGPA >= 9.0), 'First Class' (CGPA >= 7.5), or 'Pass' (below 7.5). Show name, CGPA, and the classification label.",
    hint: "CASE WHEN works like an if-else chain. Each WHEN checks a condition in order and returns the matching THEN value. Use ELSE for the default case.",
    answer: "SELECT name,\n       cgpa,\n       CASE\n         WHEN cgpa >= 9.0 THEN 'Distinction'\n         WHEN cgpa >= 7.5 THEN 'First Class'\n         ELSE 'Pass'\n       END AS classification\nFROM students\nORDER BY cgpa DESC;",
    explanation: "CASE WHEN evaluates conditions in order and returns the first matching THEN value. Once a condition matches, no further conditions are checked, so the ranges are implicitly 9+ first, then 7.5-8.9, then below 7.5.",
    schema: `
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT,
  branch TEXT,
  cgpa REAL,
  year INTEGER
);
INSERT INTO students VALUES
(1,'Rahul Kumar','CSE',8.5,3),
(2,'Priya Singh','ECE',7.8,3),
(3,'Amit Sharma','IT',9.1,4),
(4,'Neha Gupta','CSE',6.8,2),
(5,'Vikram Rao','CSE',7.5,1),
(6,'Divya Nair','ME',9.4,4),
(7,'Rohan Mehta','ECE',5.9,3),
(8,'Ananya Iyer','CSE',8.2,2);`,
  },
  {
    id: 22,
    difficulty: "Medium",
    topic: "UNION",
    question: "Create a combined list of all cities where either a customer lives or an employee works. Each city should appear only once. Sort alphabetically.",
    hint: "UNION combines the results of two SELECT statements and automatically removes duplicates. Both SELECTs must return the same number of columns.",
    answer: "SELECT city FROM customers\nUNION\nSELECT city FROM employees\nORDER BY city;",
    explanation: "UNION merges two result sets and eliminates duplicate rows. If you want to keep duplicates, use UNION ALL, which is faster because it skips the deduplication step.",
    schema: `
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  city TEXT
);
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT,
  department TEXT,
  city TEXT
);
INSERT INTO customers VALUES
(1,'Aarav Patel','Mumbai'),
(2,'Bhavna Shah','Delhi'),
(3,'Anita Kulkarni','Pune'),
(4,'Deepak Verma','Chennai'),
(5,'Aishwarya Rao','Bangalore'),
(6,'Farhan Qureshi','Hyderabad');
INSERT INTO employees VALUES
(1,'Suresh Babu','Engineering','Mumbai'),
(2,'Meena Pillai','HR','Bangalore'),
(3,'Arjun Desai','Engineering','Delhi'),
(4,'Kavitha Reddy','Finance','Kolkata'),
(5,'Nikhil Joshi','Engineering','Chennai'),
(6,'Pooja Shetty','Marketing','Ahmedabad');`,
  },
  {
    id: 23,
    difficulty: "Medium",
    topic: "GROUP BY Multiple Columns",
    question: "Find the number of students in each combination of branch and year. Show branch, year, and the student count, ordered by branch and then year.",
    hint: "You can GROUP BY more than one column. The grouping creates one result row for every unique combination of the listed columns.",
    answer: "SELECT branch,\n       year,\n       COUNT(*) AS student_count\nFROM students\nGROUP BY branch, year\nORDER BY branch, year;",
    explanation: "Listing multiple columns in GROUP BY creates groups based on unique combinations of all those columns together. A student in CSE year 3 and a student in CSE year 4 belong to different groups even though their branch is the same.",
    schema: `
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT,
  branch TEXT,
  cgpa REAL,
  year INTEGER
);
INSERT INTO students VALUES
(1,'Rahul Kumar','CSE',8.5,3),
(2,'Priya Singh','ECE',7.8,3),
(3,'Amit Sharma','CSE',9.1,4),
(4,'Neha Gupta','IT',8.7,2),
(5,'Vikram Rao','CSE',7.5,1),
(6,'Divya Nair','ECE',8.9,4),
(7,'Rohan Mehta','ECE',9.2,3),
(8,'Ananya Iyer','CSE',6.8,2),
(9,'Siddharth Rao','IT',8.1,3),
(10,'Tanvi Bhatt','CSE',8.6,4),
(11,'Karan Mehta','IT',7.9,1),
(12,'Sneha Joshi','ECE',8.3,2);`,
  },
  {
    id: 24,
    difficulty: "Medium",
    topic: "String Functions + Date Filtering",
    question: "Show the name (converted to uppercase) and order date for all orders placed in the month of March 2024. Use the customers table to get the customer name.",
    hint: "SQLite has UPPER() for text and strftime() for date extraction. Join customers to orders on customer_id. Use strftime('%Y-%m', order_date) to extract year and month.",
    answer: "SELECT UPPER(c.name) AS customer_name,\n       o.order_date\nFROM orders o\nINNER JOIN customers c ON o.customer_id = c.id\nWHERE strftime('%Y-%m', o.order_date) = '2024-03';",
    explanation: "SQLite's strftime() formats date strings. '%Y-%m' extracts just the year and month, allowing clean month-level filtering. UPPER() is a scalar function applied per row to transform string values.",
    schema: `
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  city TEXT
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER,
  product TEXT,
  amount REAL,
  order_date TEXT
);
INSERT INTO customers VALUES
(101,'Aarav Patel','Mumbai'),
(102,'Bhavna Shah','Delhi'),
(103,'Anita Kulkarni','Pune'),
(104,'Deepak Verma','Chennai');
INSERT INTO orders VALUES
(1,101,'Laptop',45000,'2024-01-10'),
(2,102,'Phone',18000,'2024-01-15'),
(3,101,'Mouse',1200,'2024-02-20'),
(4,103,'Keyboard',2500,'2024-03-01'),
(5,102,'Headphones',3500,'2024-03-10'),
(6,104,'Monitor',22000,'2024-03-15'),
(7,101,'Webcam',4000,'2024-03-22'),
(8,103,'USB Hub',1800,'2024-04-05');`,
  },
  {
    id: 25,
    difficulty: "Hard",
    topic: "Window Function - RANK",
    question: "For each department, find the employee with the second highest salary. Show department, employee name, and salary. If two employees share the second rank, include both.",
    hint: "Use RANK() OVER (PARTITION BY department ORDER BY salary DESC) to assign ranks within each department. Wrap this in a subquery or CTE and filter for rank = 2.",
    answer: "SELECT department, name, salary\nFROM (\n  SELECT name,\n         department,\n         salary,\n         RANK() OVER (\n           PARTITION BY department\n           ORDER BY salary DESC\n         ) AS rnk\n  FROM employees\n) ranked\nWHERE rnk = 2;",
    explanation: "PARTITION BY department restarts ranking within each department. RANK() assigns the same rank to ties and skips the next number (1,1,3), so filtering for rank = 2 finds the second highest salary even when there are ties.",
    schema: `
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT,
  department TEXT,
  salary REAL
);
INSERT INTO employees VALUES
(1,'Suresh Babu','Engineering',95000),
(2,'Meena Pillai','HR',62000),
(3,'Arjun Desai','Engineering',120000),
(4,'Kavitha Reddy','Finance',78000),
(5,'Nikhil Joshi','Engineering',105000),
(6,'Pooja Shetty','HR',72000),
(7,'Kiran Naik','Finance',85000),
(8,'Lakshmi Rao','HR',58000),
(9,'Deepak Menon','Finance',91000),
(10,'Pradeep Kumar','Engineering',88000);`,
  },
  {
    id: 26,
    difficulty: "Hard",
    topic: "Window Function - ROW_NUMBER with CTE",
    question: "For each student, show their name, branch, CGPA, and their rank within their branch based on CGPA (highest CGPA gets rank 1). Use ROW_NUMBER so ties get different consecutive ranks.",
    hint: "Use a CTE (WITH clause) to compute ROW_NUMBER() OVER (PARTITION BY branch ORDER BY cgpa DESC), then select from it. ROW_NUMBER always assigns unique ranks even for equal values.",
    answer: "WITH ranked_students AS (\n  SELECT name,\n         branch,\n         cgpa,\n         ROW_NUMBER() OVER (\n           PARTITION BY branch\n           ORDER BY cgpa DESC\n         ) AS branch_rank\n  FROM students\n)\nSELECT name, branch, cgpa, branch_rank\nFROM ranked_students\nORDER BY branch, branch_rank;",
    explanation: "ROW_NUMBER() assigns a unique sequential integer to every row in each partition regardless of ties. CTEs (WITH clause) improve readability by naming the intermediate result and letting you filter or join against it cleanly.",
    schema: `
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT,
  branch TEXT,
  cgpa REAL
);
INSERT INTO students VALUES
(1,'Rahul Kumar','CSE',8.5),
(2,'Priya Singh','ECE',7.8),
(3,'Amit Sharma','CSE',9.1),
(4,'Neha Gupta','IT',8.7),
(5,'Vikram Rao','CSE',7.5),
(6,'Divya Nair','ECE',8.9),
(7,'Rohan Mehta','ECE',9.2),
(8,'Ananya Iyer','CSE',8.8),
(9,'Siddharth Rao','IT',8.1),
(10,'Tanvi Bhatt','IT',9.0);`,
  },
  {
    id: 27,
    difficulty: "Hard",
    topic: "NOT EXISTS",
    question: "Find all students who have not enrolled in any course. Show their name and branch.",
    hint: "Use NOT EXISTS with a correlated subquery that checks the enrollments table for the current student. If no matching enrollment row exists, NOT EXISTS is true.",
    answer: "SELECT name, branch\nFROM students s\nWHERE NOT EXISTS (\n  SELECT 1\n  FROM enrollments e\n  WHERE e.student_id = s.id\n);",
    explanation: "NOT EXISTS returns true when the subquery produces no rows. It is often more readable and efficient than NOT IN when dealing with NULLs, because NOT IN with a subquery that returns any NULL will make the whole result empty.",
    schema: `
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT,
  branch TEXT,
  cgpa REAL
);
CREATE TABLE enrollments (
  id INTEGER PRIMARY KEY,
  student_id INTEGER,
  course_id INTEGER,
  grade TEXT
);
INSERT INTO students VALUES
(1,'Rahul Kumar','CSE',8.5),
(2,'Priya Singh','ECE',7.8),
(3,'Amit Sharma','IT',9.1),
(4,'Neha Gupta','CSE',8.7),
(5,'Vikram Rao','ECE',7.2),
(6,'Divya Nair','ME',8.4),
(7,'Rohan Mehta','CSE',6.9);
INSERT INTO enrollments VALUES
(1,1,1,'A'),(2,1,2,'B'),(3,2,1,'A'),
(4,3,2,'A'),(5,4,1,'B'),(6,6,3,'C');`,
  },
  {
    id: 28,
    difficulty: "Hard",
    topic: "Three-Table JOIN + Aggregation",
    question: "For each student, show their name, total number of courses enrolled in, and their average grade points. Convert letter grades to points: A=10, B=8, C=6, D=4. Only show students enrolled in at least 2 courses.",
    hint: "Join students, enrollments. Use CASE WHEN to convert grades to numbers inside AVG(). Use HAVING to filter by course count.",
    answer: "SELECT s.name,\n       COUNT(e.id) AS course_count,\n       AVG(\n         CASE e.grade\n           WHEN 'A' THEN 10\n           WHEN 'B' THEN 8\n           WHEN 'C' THEN 6\n           WHEN 'D' THEN 4\n           ELSE 0\n         END\n       ) AS avg_grade_points\nFROM students s\nINNER JOIN enrollments e ON s.id = e.student_id\nGROUP BY s.id, s.name\nHAVING COUNT(e.id) >= 2\nORDER BY avg_grade_points DESC;",
    explanation: "Wrapping CASE WHEN inside AVG() allows on-the-fly transformation of categorical data into numeric values for aggregation. HAVING with COUNT filters out groups (students) that do not meet the minimum enrollment threshold.",
    schema: `
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT,
  branch TEXT
);
CREATE TABLE enrollments (
  id INTEGER PRIMARY KEY,
  student_id INTEGER,
  course_id INTEGER,
  grade TEXT
);
INSERT INTO students VALUES
(1,'Rahul Kumar','CSE'),
(2,'Priya Singh','ECE'),
(3,'Amit Sharma','IT'),
(4,'Neha Gupta','CSE'),
(5,'Vikram Rao','ECE');
INSERT INTO enrollments VALUES
(1,1,1,'A'),(2,1,2,'B'),(3,1,3,'A'),
(4,2,1,'B'),(5,2,2,'C'),
(6,3,1,'A'),(7,3,3,'A'),(8,3,4,'B'),
(9,4,2,'C'),
(10,5,1,'A'),(11,5,3,'B'),(12,5,4,'C');`,
  },
  {
    id: 29,
    difficulty: "Hard",
    topic: "Finding Duplicates",
    question: "Find all products that have been ordered more than once by the same customer (i.e., duplicate orders). Show the customer_id, product name, and how many times they ordered it.",
    hint: "GROUP BY customer_id and product together. Then use HAVING COUNT(*) > 1 to keep only the combinations that appear more than once.",
    answer: "SELECT customer_id,\n       product,\n       COUNT(*) AS order_count\nFROM orders\nGROUP BY customer_id, product\nHAVING COUNT(*) > 1\nORDER BY order_count DESC;",
    explanation: "Duplicate detection works by grouping on the columns that define uniqueness and then filtering groups that have more than one row. The group represents the combination that repeats, and COUNT(*) tells you how many times.",
    schema: `
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER,
  product TEXT,
  amount REAL,
  order_date TEXT
);
INSERT INTO orders VALUES
(1,101,'Laptop',45000,'2024-01-10'),
(2,102,'Phone',18000,'2024-01-15'),
(3,101,'Mouse',1200,'2024-01-20'),
(4,103,'Laptop',46000,'2024-02-01'),
(5,102,'Phone',17500,'2024-02-10'),
(6,101,'Laptop',44000,'2024-03-01'),
(7,103,'Mouse',1100,'2024-03-05'),
(8,102,'Phone',18500,'2024-03-20'),
(9,104,'Monitor',22000,'2024-03-25'),
(10,101,'Mouse',1300,'2024-04-02');`,
  },
  {
    id: 30,
    difficulty: "Hard",
    topic: "Nested Aggregation with Subquery",
    question: "Find the department(s) with the highest average salary. Show the department name and its average salary. If two departments tie on the highest average, show both.",
    hint: "First compute average salary per department in a subquery. Then in the outer query, filter for those where the average equals the maximum of all those averages. Use a nested MAX() over the inner result.",
    answer: "SELECT department,\n       avg_salary\nFROM (\n  SELECT department,\n         AVG(salary) AS avg_salary\n  FROM employees\n  GROUP BY department\n) dept_avgs\nWHERE avg_salary = (\n  SELECT MAX(avg_salary)\n  FROM (\n    SELECT AVG(salary) AS avg_salary\n    FROM employees\n    GROUP BY department\n  )\n);",
    explanation: "You cannot directly apply MAX() to the result of AVG() in one query level because aggregate functions cannot be nested directly. Subqueries act as named intermediate tables that resolve one level of aggregation at a time.",
    schema: `
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT,
  department TEXT,
  salary REAL
);
INSERT INTO employees VALUES
(1,'Suresh Babu','Engineering',95000),
(2,'Meena Pillai','HR',62000),
(3,'Arjun Desai','Engineering',120000),
(4,'Kavitha Reddy','Finance',78000),
(5,'Nikhil Joshi','Engineering',105000),
(6,'Pooja Shetty','HR',72000),
(7,'Kiran Naik','Finance',85000),
(8,'Lakshmi Rao','HR',58000),
(9,'Deepak Menon','Finance',91000),
(10,'Pradeep Kumar','Engineering',88000);`,
  },
];

const DIFF_STYLE: Record<string, { bg: string; color: string }> = {
  Easy: { bg: "#DCFCE7", color: "#166534" },
  Medium: { bg: "#FEF3C7", color: "#92400E" },
  Hard: { bg: "#FEE2E2", color: "#991B1B" },
};

type ResultRow = Record<string, string | number | null>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function SQLPractice() {
  const [db, setDb] = useState<any>(null);
  const [loadError, setLoadError] = useState("");
  const [activeQ, setActiveQ] = useState(0);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ columns: string[]; rows: ResultRow[] } | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [execTime, setExecTime] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showExp, setShowExp] = useState(false);
  const [solved, setSolved] = useState<Set<number>>(new Set());
  const dbRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load sql.js ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const initSqlJs = (await import("sql.js")).default;
        const SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
        if (cancelled) return;
        const database = new SQL.Database();
        dbRef.current = database;
        setDb(database);
        loadQuestion(database, 0);
      } catch {
        if (!cancelled) setLoadError("Failed to load SQL engine. Run: npm install sql.js and copy sql-wasm.wasm to /public/");
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  function loadQuestion(database: any, idx: number) {
    try {
      // Drop all tables
      const tables = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
      if (tables.length > 0) {
        tables[0].values.forEach(([name]: [string]) => {
          try { database.run(`DROP TABLE IF EXISTS "${name}"`); } catch { }
        });
      }
      // Load schema for this question
      database.run(QUESTIONS[idx].schema);
      setResult(null);
      setError("");
      setQuery("");
      setShowHint(false);
      setShowAnswer(false);
      setShowExp(false);
      setExecTime(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function switchQuestion(idx: number) {
    setActiveQ(idx);
    if (dbRef.current) loadQuestion(dbRef.current, idx);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }

  function runQuery() {
    if (!dbRef.current || !query.trim()) return;
    setRunning(true);
    setError("");
    setResult(null);
    const t0 = performance.now();
    try {
      const results = dbRef.current.exec(query);
      const elapsed = Math.round(performance.now() - t0);
      setExecTime(elapsed);
      if (results.length === 0) {
        setResult({ columns: ["Result"], rows: [{ Result: "Query executed successfully (no rows returned)." }] });
      } else {
        const { columns, values } = results[0];
        const rows: ResultRow[] = values.map((row: any[]) => {
          const obj: ResultRow = {};
          columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
          return obj;
        });
        setResult({ columns, rows });
        // Mark as solved if they ran something successfully
        setSolved(prev => new Set([...prev, activeQ]));
      }
    } catch (e: any) {
      setError(e.message);
    }
    setRunning(false);
  }

  const q = QUESTIONS[activeQ];
  const diffStyle = DIFF_STYLE[q.difficulty];

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-sm px-4">
          <div className="text-[32px] mb-3">⚠️</div>
          <p className="text-[13px] font-bold text-[#EF4444] mb-2">SQL engine failed to load</p>
          <p className="text-[11px] text-[#9CA3AF] leading-relaxed">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ minHeight: "80vh" }}>

      {/* ── Left sidebar — question list ── */}
      <div
        className="flex-shrink-0 overflow-y-auto"
        style={{ width: 220, borderRight: "1px solid #F0EDE6", background: "#FAFAF8" }}
      >
        <div className="px-3 pt-4 pb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
            {QUESTIONS.length} Questions
          </p>
        </div>
        <div className="pb-4">
          {QUESTIONS.map((question, i) => {
            const ds = DIFF_STYLE[question.difficulty];
            const isActive = activeQ === i;
            const isSolved = solved.has(i);
            return (
              <button
                key={question.id}
                onClick={() => switchQuestion(i)}
                className="w-full text-left px-3 py-3 transition-colors"
                style={{
                  background: isActive ? "white" : "transparent",
                  borderLeft: isActive ? "2px solid #111" : "2px solid transparent",
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                    style={{ background: ds.bg, color: ds.color }}
                  >
                    {question.difficulty}
                  </span>
                  {isSolved && (
                    <span className="text-[10px] text-emerald-500 font-bold">✓</span>
                  )}
                </div>
                <p className="text-[11px] font-bold text-[#374151] leading-snug">{question.topic}</p>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5 leading-snug line-clamp-2">
                  {question.question.slice(0, 60)}...
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: question + editor + results ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Question header */}
        <div style={{ borderBottom: "1px solid #F0EDE6", padding: "16px 20px" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: diffStyle.bg, color: diffStyle.color }}
                >
                  {q.difficulty}
                </span>
                <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                  {q.topic}
                </span>
                <span className="text-[10px] text-[#9CA3AF]">Q{q.id} of {QUESTIONS.length}</span>
              </div>
              <p className="text-[14px] font-bold text-[#111] leading-relaxed" style={{ maxWidth: 640 }}>
                {q.question}
              </p>
            </div>

            {/* Helper buttons */}
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => { setShowHint(!showHint); setShowAnswer(false); }}
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg border transition"
                style={{
                  borderColor: showHint ? "#F59E0B" : "#E5E7EB",
                  background: showHint ? "#FFFBEB" : "white",
                  color: showHint ? "#92400E" : "#6B7280",
                }}
              >
                💡 Hint
              </button>
              <button
                onClick={() => { setShowAnswer(!showAnswer); setShowHint(false); }}
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg border transition"
                style={{
                  borderColor: showAnswer ? "#111" : "#E5E7EB",
                  background: showAnswer ? "#111" : "white",
                  color: showAnswer ? "white" : "#6B7280",
                }}
              >
                {showAnswer ? "Hide answer" : "Show answer"}
              </button>
            </div>
          </div>

          {/* Hint */}
          {showHint && (
            <div className="mt-3 rounded-xl px-4 py-2.5" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
              <p className="text-[12px] text-[#92400E]"><span className="font-bold">Hint: </span>{q.hint}</p>
            </div>
          )}

          {/* Answer */}
          {showAnswer && (
            <div className="mt-3">
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
                <div className="flex items-center justify-between px-4 py-2" style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Answer</p>
                  <button
                    onClick={() => { setQuery(q.answer); setShowAnswer(false); textareaRef.current?.focus(); }}
                    className="text-[10px] font-black text-[#6366F1] hover:underline"
                  >
                    Load into editor →
                  </button>
                </div>
                <pre className="px-4 py-3 text-[12px] font-mono text-[#374151] overflow-x-auto" style={{ background: "#F9FAFB" }}>
                  {q.answer}
                </pre>
              </div>
            </div>
          )}
          {/* Table schema — visible by default, this is what you're querying */}
          <div className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
            <div className="px-4 py-2" style={{ background: "#F0F9FF", borderBottom: "1px solid #BAE6FD" }}>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#0369A1]">📋 Table Schema</p>
            </div>
            <pre className="px-4 py-3 text-[11px] font-mono text-[#374151] overflow-x-auto whitespace-pre-wrap" style={{ background: "#FAFBFC", maxHeight: 140, overflowY: "auto" }}>
              {q.schema
                .split("\n")
                .filter((line) => line.trim().startsWith("CREATE TABLE"))
                .join("\n")}
            </pre>
          </div>
        </div>
        {/* SQL Editor */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          <div className="relative flex-1" style={{ minHeight: 140 }}>
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  runQuery();
                }
              }}
              spellCheck={false}
              placeholder={"-- Write your SQL query here\n-- Ctrl+Enter to run\n\nSELECT ..."}
              className="w-full h-full resize-none font-mono outline-none"
              style={{
                background: "#0D1117",
                color: "#E2E8F0",
                fontSize: 13,
                lineHeight: 1.8,
                padding: "16px 20px",
                minHeight: 140,
              }}
            />
          </div>

          {/* Toolbar */}
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderTop: "1px solid #1E2530", background: "#111" }}
          >
            <div className="flex items-center gap-4">
              <span className="text-[11px] text-[#555]">Ctrl+Enter to run</span>
              {execTime !== null && result && !error && (
                <span className="text-[11px] font-bold text-emerald-400">
                  ✓ {result.rows.length} row{result.rows.length !== 1 ? "s" : ""} · {execTime}ms
                </span>
              )}
              {error && <span className="text-[11px] font-bold text-red-400">✗ Error</span>}
            </div>
            <button
              onClick={runQuery}
              disabled={running || !query.trim() || !db}
              className="flex items-center gap-2 rounded-xl px-5 py-2 text-[12px] font-black transition disabled:opacity-40"
              style={{ background: "#FFD600", color: "#111" }}
            >
              {running ? "Running..." : "▶ Run Query"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{ borderTop: "1px solid #FEE2E2", background: "#FEF2F2", padding: "10px 20px" }}>
              <p className="text-[11px] font-black text-[#DC2626] uppercase tracking-widest mb-1">SQL Error</p>
              <p className="text-[12px] font-mono text-[#B91C1C]">{error}</p>
            </div>
          )}

          {/* Results */}
          {result && !error && (
            <div style={{ borderTop: "1px solid #F0EDE6", overflow: "auto", maxHeight: 220 }}>
              <table className="w-full" style={{ fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #F0EDE6", position: "sticky", top: 0 }}>
                    {result.columns.map(col => (
                      <th key={col} className="text-left font-black text-[#374151] px-4 py-2.5 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F9FAFB" }} className="hover:bg-[#FAFAF8]">
                      {result.columns.map(col => (
                        <td key={col} className="px-4 py-2 text-[#374151] whitespace-nowrap">
                          {row[col] === null
                            ? <span className="text-[#9CA3AF] italic">NULL</span>
                            : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Explanation after running */}
              <div style={{ borderTop: "1px solid #F0EDE6", padding: "10px 16px", background: "#FAFAF8" }}>
                <button
                  onClick={() => setShowExp(!showExp)}
                  className="text-[11px] font-bold text-[#6366F1] hover:underline"
                >
                  {showExp ? "Hide explanation" : "Why does this work? →"}
                </button>
                {showExp && (
                  <p className="text-[12px] text-[#555] mt-2 leading-relaxed">{q.explanation}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nav between questions */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderTop: "1px solid #F0EDE6", background: "#FAFAF8" }}
        >
          <button
            onClick={() => activeQ > 0 && switchQuestion(activeQ - 1)}
            disabled={activeQ === 0}
            className="text-[12px] font-bold text-[#374151] hover:text-[#111] disabled:text-[#D1D5DB] transition"
          >
            ← Previous
          </button>
          <div className="flex gap-1.5">
            {QUESTIONS.map((_, i) => (
              <button
                key={i}
                onClick={() => switchQuestion(i)}
                className="rounded-full transition"
                style={{
                  width: 8, height: 8,
                  background: solved.has(i) ? "#10B981" : i === activeQ ? "#111" : "#E5E7EB",
                }}
              />
            ))}
          </div>
          <button
            onClick={() => activeQ < QUESTIONS.length - 1 && switchQuestion(activeQ + 1)}
            disabled={activeQ === QUESTIONS.length - 1}
            className="text-[12px] font-bold text-[#374151] hover:text-[#111] disabled:text-[#D1D5DB] transition"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}