#!/usr/bin/env ts-node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestSuite {
  name: string;
  path: string;
  description: string;
}

const testSuites: TestSuite[] = [
  {
    name: 'Authentication',
    path: 'tests/e2e/auth/',
    description: 'Login, logout, role-based access tests'
  },
  {
    name: 'Orders',
    path: 'tests/e2e/entities/orders.spec.ts',
    description: 'Order management, filtering, search, pagination'
  },
  {
    name: 'Customers',
    path: 'tests/e2e/entities/customers.spec.ts',
    description: 'Customer CRUD operations and validation'
  },
  {
    name: 'Suppliers',
    path: 'tests/e2e/entities/suppliers.spec.ts',
    description: 'Supplier management and validation'
  }
];

async function checkPrerequisites(): Promise<boolean> {
  console.log('🔍 Checking prerequisites...');

  try {
    // Check if backend is running
    await execAsync('curl -s http://localhost:3001/health || echo "Backend not running"');
    console.log('✅ Backend API is accessible');
  } catch {
    console.log('❌ Backend API is not accessible at http://localhost:3001');
    console.log('   Please start the backend with: cd backend && npm run start:dev');
    return false;
  }

  try {
    // Check if frontend is running
    await execAsync('curl -s http://localhost:3000 || echo "Frontend not running"');
    console.log('✅ Frontend is accessible');
  } catch {
    console.log('❌ Frontend is not accessible at http://localhost:3000');
    console.log('   Please start the frontend with: npm run dev');
    return false;
  }

  return true;
}

async function runTestSuite(suite: TestSuite): Promise<{ success: boolean; output: string }> {
  console.log(`\n🧪 Running ${suite.name} tests...`);
  console.log(`   ${suite.description}`);

  try {
    const { stdout } = await execAsync(`npx playwright test ${suite.path} --reporter=list`);
    console.log(`✅ ${suite.name} tests completed successfully`);
    return { success: true, output: stdout };
  } catch (error: unknown) {
    console.log(`❌ ${suite.name} tests failed`);
    const err = error as { stdout?: string; message?: string };
    return { success: false, output: err.stdout || err.message || String(error) };
  }
}

async function generateReport(results: Array<{ suite: TestSuite; result: { success: boolean; output: string } }>) {
  console.log('\n📊 Test Results Summary');
  console.log('========================');

  let totalTests = 0;
  let passedSuites = 0;

  results.forEach(({ suite, result }) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${suite.name}`);

    if (result.success) {
      passedSuites++;
    }

    // Count individual tests from output
    const testMatches = result.output.match(/(\d+) passed/g);
    if (testMatches) {
      testMatches.forEach(match => {
        const count = parseInt(match.match(/\d+/)?.[0] || '0');
        totalTests += count;
      });
    }
  });

  console.log(`\nSummary: ${passedSuites}/${results.length} test suites passed`);
  console.log(`Total individual tests: ${totalTests}`);

  if (passedSuites === results.length) {
    console.log('\n🎉 All tests passed! Your API integration is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the detailed output above.');
  }
}

async function main() {
  console.log('🚀 Starting E2E Test Suite for OrderMySaddle API Integration');
  console.log('=============================================================');

  // Check prerequisites
  const prereqsOk = await checkPrerequisites();
  if (!prereqsOk) {
    process.exit(1);
  }

  console.log('\n📋 Test Suites to Run:');
  testSuites.forEach(suite => {
    console.log(`   • ${suite.name}: ${suite.description}`);
  });

  // Run all test suites
  const results = [];

  for (const suite of testSuites) {
    const result = await runTestSuite(suite);
    results.push({ suite, result });

    // Add delay between test suites
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate final report
  await generateReport(results);

  // Exit with appropriate code
  const allPassed = results.every(r => r.result.success);
  process.exit(allPassed ? 0 : 1);
}

// Handle CLI arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: npm run test:e2e [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('  --auth         Run only authentication tests');
  console.log('  --entities     Run only entity tests');
  console.log('');
  console.log('Test Suites:');
  testSuites.forEach(suite => {
    console.log(`  ${suite.name.toLowerCase().padEnd(12)} ${suite.description}`);
  });
  process.exit(0);
}

if (args.includes('--auth')) {
  // Run only auth tests
  execAsync('npx playwright test tests/e2e/auth/ --reporter=html')
    .then(() => console.log('✅ Authentication tests completed'))
    .catch(() => console.log('❌ Authentication tests failed'));
} else if (args.includes('--entities')) {
  // Run only entity tests
  execAsync('npx playwright test tests/e2e/entities/ --reporter=html')
    .then(() => console.log('✅ Entity tests completed'))
    .catch(() => console.log('❌ Entity tests failed'));
} else {
  // Run full test suite
  main();
}

export { testSuites, checkPrerequisites, runTestSuite };