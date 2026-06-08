// report.js - 电子斗蛐蛐：报告生成器
// 将所有角色输出格式化为 Markdown 报告

/**
 * 生成完整报告
 * @param {Object} params
 * @param {string} params.requirement - 需求描述
 * @param {string} params.techStack - 架构师选择的技术栈
 * @param {Array} params.rounds - 每轮的核心循环输出 [{architect, engineer, tester, product, summarizer, critic}]
 * @param {Array} params.userReviews - 用户评审输出 [{role, output}]
 * @param {Object} params.finalOutput - 最终整合输出 {summary, codeChanges}
 * @param {Array} params.timeline - 时间线事件 [{round, phase, event}]
 * @param {Array} params.disputes - 未解决的分歧 [{title, opinions, suggestion}]
 * @returns {string} Markdown 报告
 */
function generateReport({ requirement, techStack, rounds, userReviews, finalOutput, timeline, disputes }) {
  const lines = [];

  // 标题
  lines.push(`# 🦗 电子斗蛐蛐报告`);
  lines.push('');

  // 基本信息
  lines.push('## 基本信息');
  lines.push('');
  lines.push(`- **需求描述**：${requirement}`);
  lines.push(`- **技术栈**：${techStack || '架构师选定'}`);
  lines.push(`- **运行轮数**：${rounds.length}轮`);
  lines.push(`- **用户评审角色**：${userReviews.length}个`);
  lines.push('');

  // 角色决策摘要表
  lines.push('## 角色决策摘要');
  lines.push('');
  lines.push('| 角色 | 关键决策 | 理由 | 状态 |');
  lines.push('|------|---------|------|------|');

  if (rounds.length > 0) {
    const firstRound = rounds[0];
    // 架构师
    if (firstRound.architect) {
      const archDecision = extractFirstLine(firstRound.architect);
      lines.push(`| 🏗️ 架构师 | ${archDecision} | 详见方案 | ✅ 已确认 |`);
    }
    // 工程师
    if (firstRound.engineer) {
      const engDecision = extractFirstLine(firstRound.engineer);
      lines.push(`| 👨‍💻 工程师 | ${engDecision} | 详见代码 | ✅ 已确认 |`);
    }
    // 测试员
    const lastRound = rounds[rounds.length - 1];
    if (lastRound.tester) {
      const bugCount = countBugs(lastRound.tester);
      lines.push(`| 🧪 测试员 | 发现${bugCount}个bug | 详见下方 | ${bugCount === 0 ? '✅ 无新bug' : '⚠️ 待修复'} |`);
    }
    // 产品经理
    if (firstRound.product) {
      const prodDecision = extractFirstLine(firstRound.product);
      lines.push(`| 📋 产品经理 | ${prodDecision} | 详见评审 | ⏳ 待决定 |`);
    }
    // 批判者
    if (lastRound.critic) {
      const hasObjection = !lastRound.critic.includes('无新反对');
      lines.push(`| 🔥 批判者 | ${hasObjection ? '有反对意见' : '无新反对'} | 详见下方 | ${hasObjection ? '⏳ 未解决' : '✅ 无异议'} |`);
    }
  }
  lines.push('');

  // 时间线
  lines.push('## 时间线');
  lines.push('');
  lines.push('| 轮次 | 阶段 | 关键事件 |');
  lines.push('|------|------|---------|');

  for (const event of timeline) {
    lines.push(`| ${event.round} | ${event.phase} | ${event.event} |`);
  }
  lines.push('');

  // 各轮详细输出
  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i];
    lines.push(`## 第${i + 1}轮：核心循环`);
    lines.push('');

    const roleOrder = [
      { key: 'architect', label: '🏗️ 架构师 A' },
      { key: 'engineer', label: '👨‍💻 工程师 B' },
      { key: 'tester', label: '🧪 测试员 C' },
      { key: 'product', label: '📋 产品经理 D' },
      { key: 'summarizer', label: '📝 总结者 E' },
      { key: 'critic', label: '🔥 批判者 F' },
    ];

    for (const { key, label } of roleOrder) {
      if (round[key]) {
        lines.push(`### ${label}`);
        lines.push('');
        lines.push(round[key]);
        lines.push('');
      }
    }
  }

  // 用户评审轮
  if (userReviews.length > 0) {
    lines.push('## 用户评审轮');
    lines.push('');

    for (const review of userReviews) {
      lines.push(`### ${review.emoji} ${review.label}视角`);
      lines.push('');
      lines.push(review.output);
      lines.push('');
    }
  }

  // 最终整合
  if (finalOutput) {
    lines.push('## 最终整合');
    lines.push('');
    if (finalOutput.summary) {
      lines.push(finalOutput.summary);
      lines.push('');
    }
    if (finalOutput.codeChanges) {
      lines.push('### 最终代码修改');
      lines.push('');
      lines.push(finalOutput.codeChanges);
      lines.push('');
    }
  }

  // 未解决的分歧
  if (disputes && disputes.length > 0) {
    lines.push('## 未解决的分歧');
    lines.push('');

    for (let i = 0; i < disputes.length; i++) {
      const d = disputes[i];
      lines.push(`### ${i + 1}. ${d.title}`);
      lines.push('');

      for (const opinion of d.opinions) {
        lines.push(`- **${opinion.role}**：${opinion.view}`);
      }

      if (d.suggestion) {
        lines.push(`- 📋 **建议**：${d.suggestion}`);
      }

      lines.push(`- 👨‍⚖️ **等你拍板**`);
      lines.push('');
    }
  }

  // 最终产出
  lines.push('## 最终产出');
  lines.push('');
  lines.push('- 代码目录：`./output/`');
  lines.push('- 本报告：`./output/report.md`');
  lines.push('');
  lines.push('---');
  lines.push('*由电子斗蛐蛐系统生成*');

  return lines.join('\n');
}

/**
 * 提取文本的第一行有意义的内容
 */
function extractFirstLine(text) {
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const first = lines[0] || '';
  return first.length > 60 ? first.substring(0, 60) + '...' : first;
}

/**
 * 统计bug数量
 */
function countBugs(testerOutput) {
  const matches = testerOutput.match(/Bug #\d+/g);
  return matches ? matches.length : 0;
}

/**
 * 从架构师输出中提取技术栈
 */
function extractTechStack(architectOutput) {
  const techStackMatch = architectOutput.match(/技术栈[：:]\s*(.+)/i);
  if (techStackMatch) return techStackMatch[1].trim();

  const lines = architectOutput.split('\n');
  for (const line of lines) {
    if (line.includes('选定') || line.includes('选择')) {
      return line.replace(/^[#>*\s-]+/, '').trim();
    }
  }
  return '详见架构方案';
}

module.exports = { generateReport, extractTechStack };
