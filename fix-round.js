export const meta = {
  name: 'cricket-fix',
  description: '电子斗蛐蛐 - 协作修复轮（工程师+测试员循环修bug）',
  phases: [
    { title: '修复', detail: '工程师修bug' },
    { title: '验证', detail: '测试员验证' },
  ],
};

async function main(args) {
  let requirement, codePath, bugTracker, maxIterations;

  // 解析 args（可能是字符串或对象）
  let parsed = args;
  if (typeof args === 'string') {
    try { parsed = JSON.parse(args); } catch(e) { parsed = { requirement: args }; }
  }

  requirement = parsed.requirement || '';
  codePath = parsed.codePath || '';
  bugTracker = parsed.bugTracker || [];
  maxIterations = parsed.maxIterations || 3;

  if (typeof bugTracker === 'string') {
    try { bugTracker = JSON.parse(bugTracker); } catch(e) { bugTracker = []; }
  }

  if (!bugTracker || bugTracker.length === 0) {
    log('❌ 没有 bug 需要修复');
    return;
  }

  log(`🔧 协作修复轮开始，${bugTracker.length} 个 bug 待修复`);
  log('');

  let currentBugs = [...bugTracker];
  let iteration = 0;

  while (iteration < maxIterations && currentBugs.some(b => b.status === 'open')) {
    iteration++;
    log(`--- 修复迭代 ${iteration} ---`);

    // 工程师修复
    phase(`工程师修复 - 第${iteration}轮`);
    const openBugs = currentBugs.filter(b => b.status === 'open');
    const bugList = openBugs.map(b =>
      `- [${b.id}] [${b.severity}] ${b.title}${b.suggestion ? ' | 建议：' + b.suggestion : ''}`
    ).join('\n');

    const fixResult = await agent(
      `你是一个务实的高级工程师。请修复以下 bug。

项目代码在：${codePath || '当前目录'}

待修复 bug：
${bugList}

约束：
- 只修复上面列出的 bug，不要改其他代码
- 每个修复用 diff 格式展示
- 修复后运行测试确认通过
- P0 bug 必须修复，P1 尽量修复，P2 可以跳过

输出格式：
## 修复内容
### Bug#N: [标题]
\`\`\`diff
- 旧代码
+ 新代码
\`\`\`
修复说明：...

## 测试结果
（运行了哪些测试，结果如何）

## 未修复
（哪些 bug 没修，为什么）`,
      { label: `工程师-修复${iteration}`, phase: '修复' }
    );
    log(`  👨‍💻 工程师修复完成`);

    // 测试员验证
    phase(`测试员验证 - 第${iteration}轮`);
    const verifyResult = await agent(
      `你是一个毒舌但精准的 QA 专家。请验证以下 bug 是否已修复。

项目代码在：${codePath || '当前目录'}

之前发现的 bug：
${bugList}

工程师的修复：
${fixResult}

请：
1. 读代码，验证每个 bug 的修复是否正确
2. 运行测试，确认没有引入新 bug
3. 如果修复不正确，指出问题

输出格式：
## 验证结果
### Bug#N: [标题]
- 状态：✅ 已修复 / ❌ 未修复 / ⚠️ 部分修复
- 验证方式：...
- 问题（如有）：...

## 新发现
（如果有新 bug）

## 结论
（修复了多少，还剩多少）`,
      { label: `测试员-验证${iteration}`, phase: '验证' }
    );
    log(`  🧪 测试员验证完成`);

    // 更新 bug 状态
    const verifiedBugs = updateBugStatus(currentBugs, verifyResult);
    const stillOpen = verifiedBugs.filter(b => b.status === 'open').length;
    const nowFixed = verifiedBugs.filter(b => b.status === 'fixed').length;

    log(`  📊 状态：${nowFixed}个已修复，${stillOpen}个未修复`);

    if (stillOpen === 0) {
      log('');
      log('✅ 所有 bug 已修复！');
      break;
    }

    currentBugs = verifiedBugs;
  }

  // 最终报告
  const finalFixed = currentBugs.filter(b => b.status === 'fixed').length;
  const finalOpen = currentBugs.filter(b => b.status === 'open').length;

  log('');
  log(`🔧 修复轮结束：${finalFixed}个已修复，${finalOpen}个未修复`);
  log('');

  // 输出最终 bug 状态
  log('## 最终 Bug 状态');
  for (const b of currentBugs) {
    log(`- [${b.id}] [${b.severity}] ${b.title} → ${b.status === 'fixed' ? '✅' : '❌'}`);
  }

  return {
    type: 'fix_complete',
    bugTracker: currentBugs,
    fixedCount: finalFixed,
    openCount: finalOpen,
    iterations: iteration,
  };
}

function updateBugStatus(bugs, verifyOutput) {
  const updated = [...bugs];

  // 解析已修复
  const fixedMatches = verifyOutput.match(/Bug#?([\w-]+).*?已修复/gi) || [];
  const fixedIds = fixedMatches.map(m => {
    const match = m.match(/Bug#?([\w-]+)/);
    return match ? match[1] : null;
  }).filter(Boolean);

  // 解析未修复
  const unfixedMatches = verifyOutput.match(/Bug#?([\w-]+).*?未修复/gi) || [];
  const unfixedIds = unfixedMatches.map(m => {
    const match = m.match(/Bug#?([\w-]+)/);
    return match ? match[1] : null;
  }).filter(Boolean);

  for (const bug of updated) {
    const bugId = bug.id.replace(/^[^-]+-/, ''); // 去掉前缀如 "R1-"
    if (fixedIds.some(fid => bugId.includes(fid) || fid.includes(bugId))) {
      bug.status = 'fixed';
    } else if (unfixedIds.some(uid => bugId.includes(uid) || uid.includes(bugId))) {
      bug.status = 'open';
    }
  }

  return updated;
}

await main(args);
