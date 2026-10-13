/**
 * 生成等级经验表脚本
 * 使用指数增长公式：exp = floor(baseExp * (level ^ exponent))
 * 
 * 运行方法：node scripts/generate-level-exp.js
 */

const fs = require('fs');
const path = require('path');

// ========== 配置参数 ==========
const MAX_LEVEL = 66;           // 最高等级
const BASE_EXP = 100;            // 基础经验值
const EXPONENT = 1.5;            // 指数（1.5 是一个平衡的值）
const OUTPUT_FILE = path.join(__dirname, '../src/assets/configs/level-exp-table.json5');

// ========== 经验值计算函数 ==========
/**
 * 计算指定等级升到下一级所需的经验值
 * @param {number} level 当前等级
 * @returns {number} 升级所需经验
 */
function calculateExpForLevel(level) {
  if (level >= MAX_LEVEL) {
    return 0; // 满级，无需经验
  }
  
  // 使用指数增长公式：exp = BASE_EXP * (level ^ EXPONENT)
  // 这样可以让前期升级较快，后期越来越慢
  const exp = Math.floor(BASE_EXP * Math.pow(level, EXPONENT));
  
  return exp;
}

/**
 * 计算到达指定等级所需的累计总经验
 * @param {number} targetLevel 目标等级
 * @returns {number} 累计总经验
 */
function calculateTotalExpToLevel(targetLevel) {
  let total = 0;
  for (let i = 1; i < targetLevel; i++) {
    total += calculateExpForLevel(i);
  }
  return total;
}

// ========== 生成配置数据 ==========
function generateLevelConfig() {
  const levels = [];
  
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const exp = calculateExpForLevel(level);
    const totalExp = calculateTotalExpToLevel(level);
    
    const levelData = {
      level,
      exp
    };
    
    // 为关键等级添加描述
    if (level === 1) {
      levelData.description = `Lv${level}→${level + 1} 需要 ${exp.toLocaleString()} 经验`;
    } else if (level % 5 === 0 && level < MAX_LEVEL) {
      levelData.description = `Lv${level}→${level + 1} 需要 ${exp.toLocaleString()} 经验，累计 ${totalExp.toLocaleString()} 总经验`;
    } else if (level === MAX_LEVEL) {
      levelData.description = `满级（累计 ${totalExp.toLocaleString()} 总经验）`;
    }
    
    levels.push(levelData);
  }
  
  return {
    version: '1.1.0',
    lastUpdated: new Date().toISOString().split('T')[0],
    metadata: {
      maxLevel: MAX_LEVEL,
      formula: `exp = floor(${BASE_EXP} * level^${EXPONENT})`,
      description: '指数增长经验表，前期升级快，后期需要更多经验'
    },
    levels
  };
}

// ========== 格式化JSON5输出 ==========
function formatJSON5(data) {
  let output = '// 等级经验表（JSON5）\n';
  output += '// - 自动生成，请勿手动编辑\n';
  output += `// - 使用公式：exp = floor(${BASE_EXP} * level^${EXPONENT})\n`;
  output += `// - 最高等级：${MAX_LEVEL}\n`;
  output += '{\n';
  
  // version
  output += `  version: '${data.version}',\n`;
  output += `  lastUpdated: '${data.lastUpdated}',\n`;
  
  // metadata
  output += '  metadata: {\n';
  output += `    maxLevel: ${data.metadata.maxLevel},\n`;
  output += `    formula: '${data.metadata.formula}',\n`;
  output += `    description: '${data.metadata.description}',\n`;
  output += '  },\n';
  
  // levels array
  output += '  levels: [\n';
  
  data.levels.forEach((level, index) => {
    output += '    { ';
    output += `level: ${level.level.toString().padStart(2, ' ')}, `;
    output += `exp: ${level.exp.toString().padStart(6, ' ')}`;
    
    if (level.description) {
      output += `, description: '${level.description}'`;
    }
    
    output += ' }';
    
    if (index < data.levels.length - 1) {
      output += ',';
    }
    
    output += '\n';
  });
  
  output += '  ],\n';
  output += '}\n';
  
  return output;
}

// ========== 打印统计信息 ==========
function printStatistics(data) {
  console.log('========================================');
  console.log('等级经验表生成完成！');
  console.log('========================================');
  console.log(`最高等级: ${data.metadata.maxLevel}`);
  console.log(`计算公式: ${data.metadata.formula}`);
  console.log('');
  
  console.log('关键等级经验值：');
  [1, 5, 10, 20, 30, 40, 50, 60, MAX_LEVEL].forEach(level => {
    if (level <= MAX_LEVEL) {
      const levelData = data.levels[level - 1];
      const totalExp = calculateTotalExpToLevel(level);
      console.log(`  Lv${level.toString().padStart(2, ' ')}: 升级需要 ${levelData.exp.toLocaleString().padStart(8, ' ')} 经验 | 累计 ${totalExp.toLocaleString().padStart(10, ' ')} 总经验`);
    }
  });
  
  console.log('');
  console.log(`配置文件已保存: ${OUTPUT_FILE}`);
  console.log('========================================');
}

// ========== 主函数 ==========
function main() {
  console.log('开始生成等级经验表...');
  
  // 生成配置数据
  const config = generateLevelConfig();
  
  // 格式化为JSON5
  const output = formatJSON5(config);
  
  // 确保目录存在
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // 写入文件
  fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
  
  // 打印统计信息
  printStatistics(config);
}

// 执行
main();

