export const meta = {
  name: 'cricket-battle',
  description: '电子斗蛐蛐 v3 - 修复bug追踪和增量修复',
  phases: [
    { title: '需求整理', detail: '标准化需求' },
    { title: '核心循环', detail: '单轮：架构→代码→测试→评审→总结→批判' },
    { title: '用户评审', detail: '多视角用户角色独立评审' },
    { title: '最终整合', detail: '汇总输出' },
  ],
};

// ===== 角色 Prompt =====

const PROMPTS = {
  requirement: (raw) => `你是一个需求分析专家。请将以下用户输入标准化为结构化需求。

用户输入：
${raw}

输出格式：
## 产品名称
## 一句话描述
## 核心功能（3-5个）
## 目标用户
## 技术约束（没有就写"由架构师决定"）`,

  architect: (req, ctx) => `你是一个有10年经验的系统架构师。
性格：全局思维，喜欢画框图，说话爱用"从系统层面看"。

${ctx ? '这是后续轮次。你必须延续前轮的技术方案，不要重新设计。只根据反馈做微调。' : '这是第一轮，从零开始设计。'}

需求：
${req}

${ctx ? '前轮上下文：\n' + ctx : ''}

输出格式：
## 技术方案
### 候选方案对比
### 选定方案（技术栈 + 架构描述）
### 模块划分
### 接口定义`,

  engineer_new: (req, arch) => `你是一个务实的高级工程师。
性格：直接，"别废话先跑起来"。

这是第一轮，根据架构师方案完整实现代码。

约束：
- 每个文件开头写清楚用途
- 写完自己跑测试确认通过
- 代码可读，只在复杂逻辑处写"为什么这么做"

需求：
${req}

架构方案：
${arch}

输出格式：
## 文件列表
- path/to/file: 描述

## 代码
（每个文件完整代码）
## 自测结果`,

  engineer_fix: (req, codeSnapshot, bugList) => `你是一个务实的高级工程师。
性格：直接，"别废话先跑起来"。

这是修复轮。你必须：
1. 只修改下面标记为 open 的 bug 相关的代码
2. 不要动其他任何代码
3. 输出 diff 格式

需求：
${req}

当前代码（关键部分）：
${codeSnapshot}

待修复 Bug 列表：
${bugList}

输出格式：
## 修复内容
### Bug#N: [标题]
\`\`\`diff
- 旧代码
+ 新代码
\`\`\`
修复理由：...

## 自测结果`,

  tester: (req, code, bugList, round) => `你是一个毒舌但精准的QA专家。
性格：喜欢反问，"这里有个坑你看到没？"

${round > 1 ? `重要！这是第${round}轮。你必须：
1. 先验证下面"待验证Bug列表"中的每个bug是否已修复
2. 然后在代码中找新bug
3. 不要重复报告已确认fixed的bug` : '在代码中找 bug、边界情况、逻辑漏洞。'}

约束：
- 每个bug：严重程度（P0/P1/P2）、描述、复现步骤、修复建议

需求：
${req}

代码：
${code}

${bugList ? '待验证Bug列表：\n' + bugList : ''}

输出格式：
## Bug 验证
### 已修复 ✅
- Bug#N: [标题] → 已修复
### 未修复 ❌
- Bug#N: [标题] → 未修复
### 新发现
#### Bug#[NEW]: [标题]
- 严重程度: P0/P1/P2
- 描述: ...
- 复现步骤: ...
- 修复建议: ...
## 结论`,

  product: (req, code) => `你是一个用户体验至上的产品经理。
性格：爱举具体场景，"你妈会用这个吗？"

约束：建议必须具体到场景，跟已有产品重叠必须指出差异化

需求：
${req}

代码：
${code}

输出格式：
## 业务评审
### 功能完整性
### 流程合理性（用具体场景）
### 拓展建议
### 差异化分析`,

  summarizer: (req, context, round) => `你是冷静的会议记录员。请简洁汇总（每角色限2句话）。

需求：
${req}

本轮各角色输出：
${context}

输出格式：
## 第${round}轮总结
### 各角色观点（每角色2句话）
### 待办事项
### 结论`,

  critic: (req, context, round) => `你是一个有理有据的唱反调专家。
性格：戏剧化，"等等，你们都忽略了…"。

约束：
- 每个反对必须给出：问题 + 为什么 + 应该怎样
- 没有新反对就说"本轮无新反对"

需求：
${req}

所有角色输出：
${context}

输出格式：
## 批判意见
### 反对意见
#### #N: [标题]
- 问题：...
- 为什么是问题：...
- 应该：...
### 结论（有/无新反对）`,
};

const USER_PROMPTS = {
  delivery: (req, summary) => `你是外卖骑手。高频手机、碎片时间、单手操作。
关注：能不能单手操作、3秒内完成核心动作、户外看清屏幕。

需求：${req}
产品：${summary}

输出（简洁）：
## 外卖骑手视角
- 会不会用：...
- 操作体验：...
- 改进建议：...`,

  office: (req, summary) => `你是白领。效率导向、时间宝贵。
关注：快捷操作、批量处理、跟工作流集成。

需求：${req}
产品：${summary}

输出（简洁）：
## 白领视角
- 会不会用：...
- 效率体验：...
- 改进建议：...`,

  elderly: (req, summary) => `你是退休老人。技术不熟练，怕按错，看不清小字。
关注：字够不够大、流程够不够短、防误操作。

需求：${req}
产品：${summary}

输出（简洁）：
## 退休老人视角
- 会不会用：...
- 易用性：...
- 改进建议：...`,

  student: (req, summary) => `你是大学生。预算有限、爱尝鲜、爱分享。
关注：免费吗、有酷功能吗、能分享吗。

需求：${req}
产品：${summary}

输出（简洁）：
## 大学生视角
- 会不会用：...
- 吸引力：...
- 改进建议：...`,

  child: (req, summary) => `你是10岁小孩。不懂技术术语，界面复杂会懵。
关注：能自己搞懂吗、哪里会卡住、有成就感吗。

需求：${req}
产品：${summary}

输出（简洁）：
## 10岁小孩视角
- 会不会用：...
- 上手体验：...
- 改进建议：...`,
};

// ===== Bug 追踪工具 =====

function formatBugTracker(bugs) {
  if (!bugs || bugs.length === 0) return '（无 bug）';
  return bugs.map(b =>
    `- [${b.id}] [${b.severity}] ${b.title} → ${b.status === 'fixed' ? '✅ fixed' : '❌ open'}${b.suggestion ? ' | 建议：' + b.suggestion : ''}`
  ).join('\n');
}

function parseBugsFromTester(testerOutput, existingBugs, round) {
  const updated = JSON.parse(JSON.stringify(existingBugs || []));

  // 标记已修复
  const fixedSection = testerOutput.match(/### 已修复 ✅([\s\S]*?)(?=###|$)/);
  if (fixedSection) {
    const fixedIds = [];
    const idRegex = /Bug#?([\w-]+)/g;
    let m;
    while ((m = idRegex.exec(fixedSection[1])) !== null) fixedIds.push(m[1]);
    for (const bug of updated) {
      if (fixedIds.some(fid => bug.id.includes(fid) || fid.includes(bug.id))) {
        bug.status = 'fixed';
      }
    }
  }

  // 解析新bug
  const newBugSection = testerOutput.match(/### 新发现([\s\S]*?)(?=## 结论|$)/);
  if (newBugSection) {
    const bugBlocks = newBugSection[1].split(/####?\s*Bug/);
    for (const block of bugBlocks) {
      if (!block.trim()) continue;
      const titleMatch = block.match(/#?\[?NEW-?(\d*)\]?:?\s*(.+)/i) || block.match(/#?(\d+):?\s*(.+)/);
      if (!titleMatch) continue;
      const title = titleMatch[2].trim();
      const sevMatch = block.match(/严重程度:\s*(P[012])/);
      const descMatch = block.match(/描述:\s*(.+)/);
      const stepsMatch = block.match(/复现步骤:\s*(.+)/);
      const suggestMatch = block.match(/修复建议:\s*(.+)/);

      updated.push({
        id: `R${round}-${updated.length + 1}`,
        title,
        severity: sevMatch?.[1] || 'P2',
        status: 'open',
        round,
        desc: descMatch?.[1]?.trim() || '',
        steps: stepsMatch?.[1]?.trim() || '',
        suggestion: suggestMatch?.[1]?.trim() || '',
      });
    }
  }

  return updated;
}

function checkConvergence(bugs, round) {
  const openBugs = bugs.filter(b => b.status === 'open');
  const fixedBugs = bugs.filter(b => b.status === 'fixed');
  const newThisRound = bugs.filter(b => b.round === round);

  return {
    openCount: openBugs.length,
    fixedCount: fixedBugs.length,
    newCount: newThisRound.length,
    reason: newThisRound.length === 0
      ? `无新bug，${openBugs.length}个未修复`
      : `发现${newThisRound.length}个新bug，${openBugs.length}个未修复`,
  };
}

// ===== 主流程 =====

async function main(args) {
  const { requirement, mode, round: inputRound, previousContext, bugTracker: prevBugTracker, codeSnapshot } = typeof args === 'string'
    ? { requirement: args, mode: 'full' }
    : args;

  if (!requirement) {
    log('❌ 请提供需求描述');
    return;
  }

  // ===== 模式1：完整流程（首次运行） =====
  if (mode === 'full' || !mode) {
    log('🦗 电子斗蛐蛐 v3 启动！');
    log('');

    phase('需求整理');
    const standardizedReq = await agent(PROMPTS.requirement(requirement), { label: '需求整理', phase: '需求整理' });
    log('✅ 需求整理完成');
    log('');

    phase('核心循环 - 第1轮');
    const round1 = await runCoreRound(standardizedReq, 1, null, null);

    const summary = generateRoundSummary(1, round1);
    log('');
    log(summary);
    log('');
    log('📊 第1轮完成。请查看摘要后决定：继续 / 打回 / 进入评审');

    return {
      type: 'round_complete',
      round: 1,
      summary,
      requirement: standardizedReq,
      bugTracker: round1.bugTracker,
      codeSnapshot: round1.codeSnapshot,
    };
  }

  // ===== 模式2：单轮执行（后续轮次） =====
  if (mode === 'round') {
    const roundNum = inputRound || 2;
    log(`🔄 第${roundNum}轮核心循环`);
    log('');

    // 验证bugTracker
    const bugs = prevBugTracker || [];
    log(`  📋 上轮bug: ${bugs.filter(b => b.status === 'open').length}个open, ${bugs.filter(b => b.status === 'fixed').length}个fixed`);

    const roundData = await runCoreRound(requirement, roundNum, previousContext, bugs, codeSnapshot);

    const summary = generateRoundSummary(roundNum, roundData);
    log('');
    log(summary);
    log('');
    log(`📊 第${roundNum}轮完成。`);

    return {
      type: 'round_complete',
      round: roundNum,
      summary,
      requirement,
      bugTracker: roundData.bugTracker,
      codeSnapshot: roundData.codeSnapshot,
    };
  }

  // ===== 模式3：用户评审 =====
  if (mode === 'review') {
    phase('用户评审');
    log('👥 用户评审轮开始');

    const userRoles = [
      { key: 'delivery', label: '外卖骑手', emoji: '🛵', prompt: USER_PROMPTS.delivery },
      { key: 'office', label: '白领', emoji: '💼', prompt: USER_PROMPTS.office },
      { key: 'elderly', label: '退休老人', emoji: '👴', prompt: USER_PROMPTS.elderly },
      { key: 'student', label: '大学生', emoji: '🎓', prompt: USER_PROMPTS.student },
      { key: 'child', label: '10岁小孩', emoji: '👦', prompt: USER_PROMPTS.child },
    ];

    const reviews = await Promise.all(
      userRoles.map(r => agent(r.prompt(requirement, previousContext || ''), { label: `评审-${r.label}`, phase: '用户评审' }).then(out => ({ ...r, output: out })))
    );

    for (const r of reviews) log(`  ${r.emoji} ${r.label}完成`);

    return { type: 'review_complete', reviews };
  }

  // ===== 模式4：最终整合 =====
  if (mode === 'finalize') {
    phase('最终整合');

    const finalSummary = await agent(
      `你是总结者。汇总所有内容生成最终报告。\n\n${previousContext}`,
      { label: '最终总结', phase: '最终整合' }
    );

    log('📝 最终总结完成');
    return { type: 'finalize_complete', summary: finalSummary };
  }
}

// ===== 执行单轮核心循环 =====

async function runCoreRound(req, round, previousContext, prevBugTracker, prevCodeSnapshot) {
  const contextParts = [];
  const outputs = {};

  // A: 架构师
  const archCtx = round === 1 ? null : `前轮上下文：\n${previousContext || ''}`;
  outputs.architect = await agent(
    PROMPTS.architect(req, archCtx),
    { label: `R${round}-架构师`, phase: `核心循环 - 第${round}轮` }
  );
  contextParts.push(`【架构师】\n${outputs.architect}`);
  log('  🏗️ 架构师完成');

  // B: 工程师
  if (round === 1) {
    outputs.engineer = await agent(
      PROMPTS.engineer_new(req, outputs.architect),
      { label: `R${round}-工程师`, phase: `核心循环 - 第${round}轮` }
    );
  } else {
    const bugList = formatBugTracker(prevBugTracker?.filter(b => b.status === 'open') || []);
    const codeSnap = prevCodeSnapshot || '（无代码快照）';
    outputs.engineer = await agent(
      PROMPTS.engineer_fix(req, codeSnap, bugList),
      { label: `R${round}-工程师`, phase: `核心循环 - 第${round}轮` }
    );
  }
  contextParts.push(`【工程师】\n${outputs.engineer}`);
  log('  👨‍💻 工程师完成');

  // C: 测试员（带bug追踪表）
  const bugListForTester = prevBugTracker ? formatBugTracker(prevBugTracker) : null;
  outputs.tester = await agent(
    PROMPTS.tester(req, outputs.engineer, bugListForTester, round),
    { label: `R${round}-测试员`, phase: `核心循环 - 第${round}轮` }
  );
  contextParts.push(`【测试员】\n${outputs.tester}`);
  log('  🧪 测试员完成');

  // 更新bug追踪表
  const updatedBugs = parseBugsFromTester(outputs.tester, prevBugTracker || [], round);

  // D: 产品经理
  outputs.product = await agent(
    PROMPTS.product(req, outputs.engineer),
    { label: `R${round}-产品经理`, phase: `核心循环 - 第${round}轮` }
  );
  contextParts.push(`【产品经理】\n${outputs.product}`);
  log('  📋 产品经理完成');

  // E: 总结者
  outputs.summarizer = await agent(
    PROMPTS.summarizer(req, contextParts.join('\n\n'), round),
    { label: `R${round}-总结者`, phase: `核心循环 - 第${round}轮` }
  );
  log('  📝 总结者完成');

  // F: 批判者
  outputs.critic = await agent(
    PROMPTS.critic(req, contextParts.join('\n\n') + '\n\n【总结】\n' + outputs.summarizer, round),
    { label: `R${round}-批判者`, phase: `核心循环 - 第${round}轮` }
  );
  log('  🔥 批判者完成');

  // 收敛判断
  const convergence = checkConvergence(updatedBugs, round);
  const hasNewObjections = !outputs.critic.includes('无新反对');

  log(`  📊 Bug: ${convergence.openCount}个open / ${convergence.fixedCount}个fixed / ${convergence.newCount}个new`);
  log(`  📊 批判: ${hasNewObjections ? '有新反对' : '无新反对'}`);

  // 代码快照（工程师输出的前3000字）
  const codeSnapshot = outputs.engineer.substring(0, 3000);

  return {
    outputs,
    bugTracker: updatedBugs,
    convergence: { ...convergence, hasNewObjections },
    allContext: contextParts.join('\n\n'),
    codeSnapshot,
  };
}

// ===== 生成轮次摘要 =====

function generateRoundSummary(round, roundData) {
  const { bugTracker, convergence, outputs } = roundData;
  const openBugs = bugTracker.filter(b => b.status === 'open');
  const fixedBugs = bugTracker.filter(b => b.status === 'fixed');

  const lines = [];
  lines.push(`# 第${round}轮摘要`);
  lines.push('');
  lines.push(`## Bug 状态`);
  lines.push(`- 已修复: ${fixedBugs.length}个`);
  lines.push(`- 未修复: ${openBugs.length}个`);
  lines.push(`- 本轮新发现: ${convergence.newCount}个`);

  if (openBugs.length > 0) {
    lines.push('');
    lines.push('### 未修复 Bug');
    for (const b of openBugs.slice(0, 10)) {
      lines.push(`- [${b.id}] [${b.severity}] ${b.title}`);
    }
    if (openBugs.length > 10) lines.push(`- ... 还有${openBugs.length - 10}个`);
  }

  lines.push('');
  lines.push(`## 收敛状态`);
  lines.push(`- ${convergence.reason}`);

  lines.push('');
  lines.push(`## 批判者`);
  const hasObj = outputs.critic && !outputs.critic.includes('无新反对');
  lines.push(hasObj ? '- 有新反对意见' : '- 无新反对');

  if (convergence.newCount === 0 && !hasObj) {
    lines.push('');
    lines.push('✅ **核心循环已收敛，建议进入用户评审。**');
  } else if (round >= 3) {
    lines.push('');
    lines.push('⚠️ **已达最大轮数，建议进入用户评审。**');
  } else {
    lines.push('');
    lines.push(`🔄 **建议继续第${round + 1}轮。**`);
  }

  // Bug追踪表（供下轮使用）
  lines.push('');
  lines.push('## Bug 追踪表（供下轮使用）');
  lines.push('```json');
  lines.push(JSON.stringify(bugTracker, null, 2));
  lines.push('```');

  return lines.join('\n');
}

await main(args);
