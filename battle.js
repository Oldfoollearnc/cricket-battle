export const meta = {
  name: 'cricket-battle',
  description: '电子斗蛐蛐 v2 - 单轮执行，支持人类裁判检查点',
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

职责：
- 分析需求，提出技术方案
- 选技术栈，必须给≥2个候选方案，说明为什么选A不选B
- 定义模块划分（具体到每个模块负责什么）

约束：
- 方案必须可落地
- 模块划分要具体，不要只写模块名

需求：
${req}

${ctx || '你是第一个发言的角色。'}

输出格式：
## 技术方案
### 候选方案对比
### 选定方案（技术栈 + 架构描述）
### 模块划分（每个模块名称 + 职责）
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
（每个文件完整代码，用代码块包裹）
## 自测结果
（跑了哪些测试，结果如何）`,

  engineer_fix: (req, currentCode, bugTracker) => `你是一个务实的高级工程师。
性格：直接，"别废话先跑起来"。

这是修复轮。你必须：
1. 只修改下面标记为 open 的 bug 相关的代码
2. 不要动其他任何代码
3. 输出 diff 格式（不是完整代码）

需求：
${req}

当前代码：
${currentCode}

Bug 追踪表：
${bugTracker}

输出格式：
## 修复内容
（每个修复用 diff 格式）
### Bug#N: [标题]
\`\`\`diff
// 修改前
- 旧代码
// 修改后
+ 新代码
\`\`\`
修复理由：...

## 自测结果
（验证了哪些bug已修复）`,

  tester: (req, code, bugTracker, round) => `你是一个毒舌但精准的QA专家。
性格：喜欢反问，"这里有个坑你看到没？"

${round > 1 ? `你必须：
1. 先验证上一轮的 open bugs 是否已修复
2. 然后在新代码中找新bug
3. 不要重复报告已确认 fixed 的 bug` : '在代码中找 bug、边界情况、逻辑漏洞。'}

约束：
- 每个bug：严重程度（P0/P1/P2）、描述、复现步骤、修复建议
- 已修复的bug标注 ✅，未修复的标注 ❌

需求：
${req}

代码：
${code}

${bugTracker ? 'Bug 追踪表（上轮状态）：\n' + bugTracker : ''}

输出格式：
## Bug 验证
### 已修复 ✅
- Bug#N: [标题] → 已修复
### 未修复 ❌
- Bug#N: [标题] → 未修复，原因：...
### 新发现
#### Bug#[NEW]: [标题]
- 严重程度: P0/P1/P2
- 描述: ...
- 复现步骤: ...
- 修复建议: ...

## 结论
（本轮新发现X个，已修复Y个，未修复Z个）`,

  product: (req, code) => `你是一个用户体验至上的产品经理。
性格：爱举具体场景，"你妈会用这个吗？"

约束：
- 建议必须具体到场景
- 跟已有产品重叠必须指出差异化

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

  summarizer: (req, roundOutputs, round) => `你是冷静的会议记录员。请简洁汇总。

需求：
${req}

本轮各角色输出：
${roundOutputs}

输出格式（每个角色限2句话）：
## 第${round}轮总结
### 各角色观点（每角色2句话）
### 待办事项
### 结论`,

  critic: (req, roundOutputs, round) => `你是一个有理有据的唱反调专家。
性格：戏剧化，"等等，你们都忽略了…"。

约束：
- 每个反对必须给出：问题 + 为什么 + 你认为应该怎样
- 没有新反对就说"本轮无新反对"，不要硬挑刺

需求：
${req}

所有角色输出：
${roundOutputs}

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

function parseBugsFromTesterOutput(testerOutput) {
  const bugs = [];
  const lines = testerOutput.split('\n');
  let currentBug = null;

  for (const line of lines) {
    const newBugMatch = line.match(/####?\s*Bug#?\[?NEW\]?:?\s*(.+)/i);
    const existBugMatch = line.match(/####?\s*Bug#(\d+):?\s*(.+)/i);

    if (newBugMatch) {
      if (currentBug) bugs.push(currentBug);
      currentBug = { id: `NEW_${bugs.length + 1}`, title: newBugMatch[1].trim(), severity: 'P2', status: 'open', round: 0, desc: '', steps: '', suggestion: '' };
    } else if (existBugMatch && !line.includes('已修复') && !line.includes('未修复')) {
      if (currentBug) bugs.push(currentBug);
      currentBug = { id: existBugMatch[1], title: existBugMatch[2].trim(), severity: 'P2', status: 'open', round: 0, desc: '', steps: '', suggestion: '' };
    }

    if (currentBug) {
      if (line.includes('P0')) currentBug.severity = 'P0';
      if (line.includes('P1')) currentBug.severity = 'P1';
      if (line.includes('P2')) currentBug.severity = 'P2';
      if (line.includes('描述')) currentBug.desc = line.replace(/.*描述[:：]\s*/, '').trim();
      if (line.includes('复现')) currentBug.steps = line.replace(/.*复现[:：]\s*/, '').trim();
      if (line.includes('修复建议')) currentBug.suggestion = line.replace(/.*修复建议[:：]\s*/, '').trim();
    }
  }
  if (currentBug) bugs.push(currentBug);
  return bugs;
}

function formatBugTracker(bugs) {
  if (!bugs || bugs.length === 0) return '（无 bug）';
  return bugs.map(b =>
    `- Bug#${b.id} [${b.severity}] ${b.title} → ${b.status === 'fixed' ? '✅ fixed' : '❌ open'}${b.suggestion ? ' → 建议：' + b.suggestion : ''}`
  ).join('\n');
}

function updateBugTracker(existingBugs, testerOutput, round) {
  const verified = [];

  // 解析已修复
  const fixedMatches = testerOutput.match(/Bug#(\d+).*?已修复/gi) || [];
  const fixedIds = fixedMatches.map(m => m.match(/Bug#(\d+)/)?.[1]).filter(Boolean);

  // 解析未修复
  const unfixedMatches = testerOutput.match(/Bug#(\d+).*?未修复/gi) || [];
  const unfixedIds = unfixedMatches.map(m => m.match(/Bug#(\d+)/)?.[1]).filter(Boolean);

  // 更新已有bug状态
  for (const bug of existingBugs) {
    if (fixedIds.includes(String(bug.id))) {
      bug.status = 'fixed';
    }
    bug.round = round;
    verified.push(bug);
  }

  // 解析新bug
  const newBugs = parseBugsFromTesterOutput(testerOutput);
  for (const nb of newBugs) {
    if (nb.id.startsWith('NEW_')) {
      nb.id = String(existingBugs.length + newBugs.indexOf(nb) + 1);
      nb.round = round;
      verified.push(nb);
    }
  }

  return verified;
}

function checkConvergence(bugs, consecutiveCleanRounds, round) {
  const openBugs = bugs.filter(b => b.status === 'open');
  const newBugsThisRound = bugs.filter(b => b.round === round);

  if (openBugs.length === 0 && newBugsThisRound.length === 0) {
    return { converged: true, consecutive: consecutiveCleanRounds + 1, reason: '无新bug且所有bug已修复' };
  }
  if (newBugsThisRound.length === 0) {
    return { converged: consecutiveCleanRounds + 1 >= 2, consecutive: consecutiveCleanRounds + 1, reason: `无新bug，但还有${openBugs.length}个未修复` };
  }
  return { converged: false, consecutive: 0, reason: `发现${newBugsThisRound.length}个新bug` };
}

// ===== 主流程 =====

async function main(args) {
  const { requirement, mode, round: inputRound, previousContext, bugTracker: prevBugTracker } = typeof args === 'string'
    ? { requirement: args, mode: 'full' }
    : args;

  if (!requirement) {
    log('❌ 请提供需求描述');
    return;
  }

  // ===== 模式1：完整流程（首次运行） =====
  if (mode === 'full' || !mode) {
    log('🦗 电子斗蛐蛐 v2 启动！');
    log('');

    // 需求收集
    phase('需求整理');
    const standardizedReq = await agent(PROMPTS.requirement(requirement), { label: '需求整理', phase: '需求整理' });
    log('✅ 需求整理完成');
    log('');

    // 第1轮核心循环
    phase('核心循环 - 第1轮');
    const round1 = await runCoreRound(standardizedReq, 1, null, null);

    // 输出摘要供人类判断
    const summary = generateRoundSummary(standardizedReq, 1, round1);
    log('');
    log(summary);
    log('');
    log('📊 第1轮完成。请查看摘要后决定：继续 / 打回 / 进入评审');

    return {
      type: 'round_complete',
      round: 1,
      summary,
      requirement: standardizedReq,
      roundData: round1,
      bugTracker: round1.bugTracker,
    };
  }

  // ===== 模式2：单轮执行（后续轮次） =====
  if (mode === 'round') {
    const roundNum = inputRound || 2;
    log(`🔄 第${roundNum}轮核心循环`);
    log('');

    const roundData = await runCoreRound(requirement, roundNum, previousContext, prevBugTracker);

    const summary = generateRoundSummary(requirement, roundNum, roundData);
    log('');
    log(summary);
    log('');
    log(`📊 第${roundNum}轮完成。`);

    return {
      type: 'round_complete',
      round: roundNum,
      summary,
      requirement,
      roundData,
      bugTracker: roundData.bugTracker,
    };
  }

  // ===== 模式3：用户评审 =====
  if (mode === 'review') {
    phase('用户评审');
    log('👥 用户评审轮开始');

    const codeSummary = previousContext || '';

    const userRoles = [
      { key: 'delivery', label: '外卖骑手', emoji: '🛵', prompt: USER_PROMPTS.delivery },
      { key: 'office', label: '白领', emoji: '💼', prompt: USER_PROMPTS.office },
      { key: 'elderly', label: '退休老人', emoji: '👴', prompt: USER_PROMPTS.elderly },
      { key: 'student', label: '大学生', emoji: '🎓', prompt: USER_PROMPTS.student },
      { key: 'child', label: '10岁小孩', emoji: '👦', prompt: USER_PROMPTS.child },
    ];

    const reviews = await Promise.all(
      userRoles.map(r => agent(r.prompt(requirement, codeSummary), { label: `评审-${r.label}`, phase: '用户评审' }).then(out => ({ ...r, output: out })))
    );

    for (const r of reviews) log(`  ${r.emoji} ${r.label}完成`);

    return { type: 'review_complete', reviews };
  }

  // ===== 模式4：最终整合 =====
  if (mode === 'finalize') {
    phase('最终整合');

    const finalSummary = await agent(
      `你是总结者。汇总所有内容生成最终报告。${previousContext}`,
      { label: '最终总结', phase: '最终整合' }
    );

    log('📝 最终总结完成');
    return { type: 'finalize_complete', summary: finalSummary };
  }
}

// ===== 执行单轮核心循环 =====

async function runCoreRound(req, round, previousContext, prevBugTracker) {
  const contextParts = [];
  const outputs = {};

  // A: 架构师（第1轮完整设计，后续轮次只微调）
  outputs.architect = await agent(
    PROMPTS.architect(req, round === 1 ? null : `前轮上下文：\n${previousContext}`),
    { label: `R${round}-架构师`, phase: `核心循环 - 第${round}轮` }
  );
  contextParts.push(`【架构师】\n${outputs.architect}`);
  log('  🏗️ 架构师完成');

  // B: 工程师（第1轮写完整代码，后续轮次只输出diff）
  if (round === 1) {
    outputs.engineer = await agent(
      PROMPTS.engineer_new(req, outputs.architect),
      { label: `R${round}-工程师`, phase: `核心循环 - 第${round}轮` }
    );
  } else {
    outputs.engineer = await agent(
      PROMPTS.engineer_fix(req, previousContext, formatBugTracker(prevBugTracker)),
      { label: `R${round}-工程师`, phase: `核心循环 - 第${round}轮` }
    );
  }
  contextParts.push(`【工程师】\n${outputs.engineer}`);
  log('  👨‍💻 工程师完成');

  // C: 测试员（带bug追踪表）
  outputs.tester = await agent(
    PROMPTS.tester(req, outputs.engineer, prevBugTracker ? formatBugTracker(prevBugTracker) : null, round),
    { label: `R${round}-测试员`, phase: `核心循环 - 第${round}轮` }
  );
  contextParts.push(`【测试员】\n${outputs.tester}`);
  log('  🧪 测试员完成');

  // 更新bug追踪表
  const allBugs = prevBugTracker || [];
  const updatedBugs = updateBugTracker(allBugs, outputs.tester, round);

  // D: 产品经理
  outputs.product = await agent(
    PROMPTS.product(req, outputs.engineer),
    { label: `R${round}-产品经理`, phase: `核心循环 - 第${round}轮` }
  );
  contextParts.push(`【产品经理】\n${outputs.product}`);
  log('  📋 产品经理完成');

  // E: 总结者（压缩版）
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
  const hasNewObjections = !outputs.critic.includes('无新反对');
  const convergence = checkConvergence(updatedBugs, 0, round);

  log(`  📊 Bug: ${updatedBugs.filter(b => b.status === 'open').length}个open / ${updatedBugs.filter(b => b.status === 'fixed').length}个fixed`);
  log(`  📊 批判: ${hasNewObjections ? '有新反对' : '无新反对'}`);

  return {
    outputs,
    bugTracker: updatedBugs,
    convergence: { ...convergence, hasNewObjections },
    allContext: contextParts.join('\n\n'),
  };
}

// ===== 生成轮次摘要 =====

function generateRoundSummary(req, round, roundData) {
  const { bugTracker, convergence, outputs } = roundData;
  const openBugs = bugTracker.filter(b => b.status === 'open');
  const fixedBugs = bugTracker.filter(b => b.status === 'fixed');

  const lines = [];
  lines.push(`# 第${round}轮摘要`);
  lines.push('');
  lines.push(`## Bug 状态`);
  lines.push(`- 已修复: ${fixedBugs.length}个`);
  lines.push(`- 未修复: ${openBugs.length}个`);

  if (openBugs.length > 0) {
    lines.push('');
    lines.push('### 未修复 Bug');
    for (const b of openBugs) {
      lines.push(`- Bug#${b.id} [${b.severity}] ${b.title}`);
    }
  }

  lines.push('');
  lines.push(`## 收敛状态`);
  lines.push(`- ${convergence.reason}`);
  lines.push(`- 连续无新问题轮数: ${convergence.consecutive}/2`);

  lines.push('');
  lines.push(`## 批判者`);
  const hasObj = !outputs.critic.includes('无新反对');
  lines.push(hasObj ? '- 有新反对意见（详见批判者输出）' : '- 无新反对');

  if (convergence.converged) {
    lines.push('');
    lines.push('✅ **核心循环已收敛，建议进入用户评审。**');
  } else if (round >= 3) {
    lines.push('');
    lines.push('⚠️ **已达最大轮数，建议进入用户评审。**');
  } else {
    lines.push('');
    lines.push(`🔄 **建议继续第${round + 1}轮。**`);
  }

  return lines.join('\n');
}

await main(args);
