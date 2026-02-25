const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Проверка окружения...\n');

// Проверка Node.js
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  console.log(`✅ Node.js: ${nodeVersion}`);
} catch (error) {
  console.error('❌ Node.js не установлен!');
  console.error('📥 Установите Node.js с https://nodejs.org/');
  process.exit(1);
}

// Проверка npm
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log(`✅ npm: ${npmVersion}`);
} catch (error) {
  console.error('❌ npm не найден!');
  console.error('📥 Переустановите Node.js с https://nodejs.org/');
  process.exit(1);
}

// Проверка node_modules
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('\n📦 Установка зависимостей...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Зависимости установлены\n');
  } catch (error) {
    console.error('❌ Ошибка установки зависимостей!');
    process.exit(1);
  }
} else {
  console.log('\n✅ Зависимости уже установлены\n');
}
