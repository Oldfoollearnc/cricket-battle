// battle.js - 电子斗蛐蛐：核心工作流（自包含版本）
// 这是一个 Claude Code Workflow 脚本，所有逻辑内联

const meta = {
  name: 'cricket-battle',
  description: '电子斗蛐蛐 - 多角色AI协作对抗系统',
  phases: [
    { title: '需求收集', detail: '解析用户输入，标准化需求' },
    { title: '核心循环', detail: '架构师→工程师→测试→产品→总结→批判' },
    { title: '用户评审', detail: '多视角用户角色独立评审' },
    { title: '最终整合', detail: '汇总意见，生成最终代码和报告' },
  ],
};

// ===== 角色定义 =====

const CORE_ROLES = {
  architect: {
    label: '架构师 A',
    emoji: '🏗️',
    buildPrompt: (req, ctx, round) => `你是一个有10年经验的系统架构师。
性格：全局思维，喜欢画框图，说话爱用"从系统层面看"。

你的职责：
- 分析需求，提出技术方案
- 选择技术栈并说明理由（必须给出至少2个候选方案，说明为什么选A不选B）
- 定义模块划分和接口

约束：
- 方案必须可落地，不要画大饼
- 模块划分要具体到每个模块负责什么，不要只写模块名

需求描述：
${req}

${ctx ? '前面角色的输出：\n' + ctx : '这是第一轮，你是第一个发言的角色。'}

请输出你的技术方案。格式：
## 技术方案
### 候选方案对比
（列出至少2个候选方案，说明选择理由）
### 选定方案
（技术栈、架构描述）
### 模块划分
（每个模块的名称和职责）
### 接口定义
（模块间的关键接口）`
  },

  engineer: {
    label: '工程师 B',
    emoji: '👨‍💻',
    buildPrompt: (req, ctx, round) => `你是一个务实的高级工程师。
性格：直接，"别废话先跑起来"，对过度设计不耐烦。

你的职责：
- 根据架构师的方案写代码
${round > 1 ? `- 第${round}轮：只修改测试员和批判者指出的问题，不动其他代码` : '- 这是第一轮，根据架构师方案完整实现'}
- 代码必须可运行、有测试

约束：
- 每个文件开头写清楚这个文件是干什么的
- 写完代码后自己先跑一遍测试，确认通过再提交
- 不要写注释解释"这段代码做了什么"，代码本身要可读；只在复杂逻辑处写"为什么这么做"

需求描述：
${req}

前面角色的输出：
${ctx}

${round > 1 ? `这是第${round}轮。请根据测试员和批判者的反馈，只修改他们指出的问题，不要动其他代码。` : '这是第一轮。请根据架构师的方案实现代码。'}

请输出你要创建的文件列表和每个文件的完整代码。格式：
## 代码实现
### 文件列表
- path/to/file1.ext: 描述
- path/to/file2.ext: 描述

### 代码
（每个文件的完整代码，用代码块包裹，文件路径写在代码块开头）`
  },

  tester: {
    label: '测试员 C',
    emoji: '🧪',
    buildPrompt: (req, ctx, round, prevBugs) => `你是一个毒舌但精准的QA专家。
性格：喜欢反问，"这里有个坑你看到没？"

你的职责：
- 读代码，找 bug、边界情况、逻辑漏洞
- 跑测试，报告失败的用例

约束：
- 每个bug必须附带：严重程度（P0/P1/P2）、复现步骤、修复建议
${round > 1 ? `- 第${round}轮：对照上一轮的bug列表，标注哪些已修复、哪些未修复、是否有新bug` : ''}

需求描述：
${req}

前面角色的输出：
${ctx}

${prevBugs ? '上一轮发现的bug：\n' + prevBugs : ''}

请输出你的测试结果。格式：
## 测试报告
### 测试执行情况
（运行了哪些测试，通过/失败情况）
### Bug 列表
（每个bug用以下格式）
#### Bug #N: [标题]
- 严重程度: P0/P1/P2
- 描述: ...
- 复现步骤: ...
- 修复建议: ...
${round > 1 ? '### Bug 追踪\n（上一轮bug的修复状态）' : ''}
### 结论
（本轮是否发现新bug）`
  },

  product: {
    label: '产品经理 D',
    emoji: '📋',
    buildPrompt: (req, ctx) => `你是一个用户体验至上的产品经理。
性格：爱举具体场景，"你妈会用这个吗？"

你的职责：
- 从业务角度评审：功能是否完整、流程是否合理
- 提出业务拓展建议

约束：
- 业务建议必须具体到场景，不要说"用户体验不好"，要说"外卖骑手在骑车时想快速记一笔，但需要3次点击才能进入记账页面"
- 如果功能跟已有产品（支付宝/微信/XX）重叠，必须指出差异化点

需求描述：
${req}

前面角色的输出：
${ctx}

请输出你的业务评审。格式：
## 业务评审
### 功能完整性
（是否有遗漏的核心功能）
### 流程合理性
（用户操作流程是否顺畅，用具体场景说明）
### 业务拓展建议
（可以加什么功能提升价值）
### 差异化分析
（跟已有产品比，优势在哪）`
  },

  summarizer: {
    label: '总结者 E',
    emoji: '📝',
    buildPrompt: (req, ctx, round) => `你是一个冷静的会议记录员。
性格：条理清晰，不带情绪。

你的职责：
- 汇总所有角色的意见
- 整理待办事项

需求描述：
${req}

本轮所有角色的输出：
${ctx}

这是第${round}轮。请输出本轮总结。格式：
## 第${round}轮总结
### 各角色观点摘要
（每个角色1-2句话概括）
### 待办事项
（需要在下一轮处理的事项列表）
### 本轮结论
（本轮的整体进展）`
  },

  critic: {
    label: '批判者 F',
    emoji: '🔥',
    buildPrompt: (req, ctx, round) => `你是一个有理有据的唱反调专家。
性格：戏剧化，"等等，你们都忽略了…"，喜欢唱反调但有理有据。

你的职责：
- 专挑别人没看到的问题
- 质疑技术选型、业务逻辑、代码实现

约束：
- 每个反对意见必须给出：问题是什么、为什么是问题、你认为应该怎么做
- 不接受"我觉得不好"这种没有理由的反对
- 如果你确实没有新的反对意见，明确说"本轮无新反对"，不要为了存在感硬挑刺

需求描述：
${req}

前面所有角色的输出：
${ctx}

请输出你的批判意见。格式：
## 批判意见
### 反对意见列表
（每个意见用以下格式）
#### 反对 #N: [标题]
- 问题是什么: ...
- 为什么是问题: ...
- 我认为应该: ...
### 结论
（是否有新反对意见）`
  }
};

const USER_ROLES = [
  {
    name: 'delivery',
    label: '外卖骑手',
    emoji: '🛵',
    buildPrompt: (req, summary) => `你是一个外卖骑手，每天用手机接单、导航、记账。
你的视角：高频使用手机，碎片时间操作，经常单手使用。
你的关注点：能不能单手操作、3秒内完成核心动作、在阳光下能不能看清屏幕。

需求描述：
${req}

产品概述：
${summary}

请从你的视角评审这个产品。格式：
## 外卖骑手视角评审
### 我会用吗？
### 操作体验
### 改进建议`
  },
  {
    name: 'office',
    label: '白领',
    emoji: '💼',
    buildPrompt: (req, summary) => `你是一个朝九晚五的白领，工作忙碌，追求效率。
你的视角：效率导向，主要用电脑，时间宝贵。
你的关注点：有没有快捷操作、能不能批量处理、能不能跟工作流集成。

需求描述：
${req}

产品概述：
${summary}

请从你的视角评审这个产品。格式：
## 白领视角评审
### 我会用吗？
### 效率体验
### 改进建议`
  },
  {
    name: 'elderly',
    label: '退休老人',
    emoji: '👴',
    buildPrompt: (req, summary) => `你是一个退休老人，不太会用智能手机，子女教你才学会微信。
你的视角：技术不熟练，怕按错，看不清小字。
你的关注点：字够不够大、流程够不够短、有没有确认步骤防误操作。

需求描述：
${req}

产品概述：
${summary}

请从你的视角评审这个产品。格式：
## 退休老人视角评审
### 我会用吗？
### 易用性体验
### 改进建议`
  },
  {
    name: 'student',
    label: '大学生',
    emoji: '🎓',
    buildPrompt: (req, summary) => `你是一个大学生，预算有限，喜欢尝试新东西，社交媒体重度用户。
你的视角：预算敏感，爱尝鲜，喜欢分享。
你的关注点：免费吗、有什么酷功能、能不能分享到朋友圈。

需求描述：
${req}

产品概述：
${summary}

请从你的视角评审这个产品。格式：
## 大学生视角评审
### 我会用吗？
### 吸引力体验
### 改进建议`
  },
  {
    name: 'child',
    label: '10岁小孩',
    emoji: '👦',
    buildPrompt: (req, summary) => `你是一个10岁的小孩，会用平板看动画片和玩游戏，但没用过复杂的工具类App。
你的视角：完全不懂技术术语，看到复杂的界面会懵，喜欢颜色鲜艳的东西。
你的关注点：能不能自己搞懂怎么用、哪里会卡住、有没有成就感反馈。

需求描述：
${req}

产品概述：
${summary}

请从你的视角评审这个产品。格式：
## 10岁小孩视角评审
### 我会用吗？
### 上手体验
### 改进建议`
  }
];

// ===== 辅助函数 =====

function countBugs(text) {
  const matches = text.match(/Bug #\d+/g);
  return matches ? matches.length : 0;
}

function extractTechStack(archOutput) {
  const lines = archOutput.split('\n');
  for (const line of lines) {
    if (line.includes('选定') && line.includes('方案')) {
      return line.replace(/^[#>*\s-]+/, '').trim();
    }
  }
  return '详见架构方案';
}

function extractFirstLine(text) {
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const first = lines[0] || '';
  return first.length > 60 ? first.substring(0, 60) + '...' : first;
}

function generateReport({ requirement, techStack, rounds, userReviews, finalSummary, finalCode, timeline, disputes }) {
  const lines = [];

  lines.push('# 🦗 电子斗蛐蛐报告');
  lines.push('');
  lines.push('## 基本信息');
  lines.push('');
  lines.push(`- **需求描述**：${requirement}`);
  lines.push(`- **技术栈**：${techStack}`);
  lines.push(`- **运行轮数**：${rounds.length}轮`);
  lines.push(`- **用户评审角色**：${userReviews.length}个`);
  lines.push('');

  // 决策摘要表
  lines.push('## 角色决策摘要');
  lines.push('');
  lines.push('| 角色 | 关键决策 | 理由 | 状态 |');
  lines.push('|------|---------|------|------|');

  if (rounds.length > 0) {
    const r0 = rounds[0];
    const rLast = rounds[rounds.length - 1];

    if (r0.architect) {
      lines.push(`| 🏗️ 架构师 | ${extractFirstLine(r0.architect)} | 详见方案 | ✅ 已确认 |`);
    }
    if (r0.engineer) {
      lines.push(`| 👨‍💻 工程师 | ${extractFirstLine(r0.engineer)} | 详见代码 | ✅ 已确认 |`);
    }
    if (rLast.tester) {
      const bc = countBugs(rLast.tester);
      lines.push(`| 🧪 测试员 | 发现${bc}个bug | 详见下方 | ${bc === 0 ? '✅ 无新bug' : '⚠️ 待修复'} |`);
    }
    if (r0.product) {
      lines.push(`| 📋 产品经理 | ${extractFirstLine(r0.product)} | 详见评审 | ⏳ 待决定 |`);
    }
    if (rLast.critic) {
      const hasObj = !rLast.critic.includes('无新反对');
      lines.push(`| 🔥 批判者 | ${hasObj ? '有反对意见' : '无新反对'} | 详见下方 | ${hasObj ? '⏳ 未解决' : '✅ 无异议'} |`);
    }
  }
  lines.push('');

  // 时间线
  lines.push('## 时间线');
  lines.push('');
  lines.push('| 轮次 | 阶段 | 关键事件 |');
  lines.push('|------|------|---------|');
  for (const e of timeline) {
    lines.push(`| ${e.round} | ${e.phase} | ${e.event} |`);
  }
  lines.push('');

  // 各轮详情
  const roleOrder = [
    { key: 'architect', label: '🏗️ 架构师 A' },
    { key: 'engineer', label: '👨‍💻 工程师 B' },
    { key: 'tester', label: '🧪 测试员 C' },
    { key: 'product', label: '📋 产品经理 D' },
    { key: 'summarizer', label: '📝 总结者 E' },
    { key: 'critic', label: '🔥 批判者 F' },
  ];

  for (let i = 0; i < rounds.length; i++) {
    lines.push(`## 第${i + 1}轮：核心循环`);
    lines.push('');
    for (const { key, label } of roleOrder) {
      if (rounds[i][key]) {
        lines.push(`### ${label}`);
        lines.push('');
        lines.push(rounds[i][key]);
        lines.push('');
      }
    }
  }

  // 用户评审
  if (userReviews.length > 0) {
    lines.push('## 用户评审轮');
    lines.push('');
    for (const r of userReviews) {
      lines.push(`### ${r.emoji} ${r.label}视角`);
      lines.push('');
      lines.push(r.output);
      lines.push('');
    }
  }

  // 最终整合
  lines.push('## 最终整合');
  lines.push('');
  if (finalSummary) {
    lines.push(finalSummary);
    lines.push('');
  }
  if (finalCode) {
    lines.push('### 最终代码修改');
    lines.push('');
    lines.push(finalCode);
    lines.push('');
  }

  // 未解决分歧
  if (disputes.length > 0) {
    lines.push('## 未解决的分歧');
    lines.push('');
    for (let i = 0; i < disputes.length; i++) {
      const d = disputes[i];
      lines.push(`### ${i + 1}. ${d.title}`);
      lines.push('');
      for (const o of d.opinions) {
        lines.push(`- **${o.role}**：${o.view}`);
      }
      if (d.suggestion) lines.push(`- 📋 **建议**：${d.suggestion}`);
      lines.push('- 👨‍⚖️ **等你拍板**');
      lines.push('');
    }
  }

  lines.push('## 最终产出');
  lines.push('');
  lines.push('- 代码目录：`./output/`');
  lines.push('- 本报告：`./output/report.md`');
  lines.push('');
  lines.push('---');
  lines.push('*由电子斗蛐蛐系统生成*');

  return lines.join('\n');
}

// ===== 主流程 =====

async function main(args) {
  const requirement = typeof args === 'string' ? args : (args && args.requirement) || '';

  if (!requirement) {
    log('❌ 请提供需求描述');
    return;
  }

  log(`🦗 电子斗蛐蛐开始！需求：${requirement}`);
  log('');

  // ===== 阶段一：需求收集 =====
  phase('需求收集');

  const standardizedReq = await agent(
    `你是一个需求分析专家。请将以下用户输入标准化为结构化的需求描述。

用户输入：
${requirement}

输出格式：
## 产品名称
## 一句话描述
## 核心功能（3-5个）
## 目标用户
## 技术约束（如果没有就写"由架构师决定"）`,
    { label: '需求整理', phase: '需求收集' }
  );

  log('✅ 需求整理完成');
  log('');

  // ===== 阶段二：核心循环 =====
  phase('核心循环');

  const rounds = [];
  const timeline = [];
  let consecutiveCleanRounds = 0;
  let prevBugs = '';
  let accumulatedContext = standardizedReq;

  for (let round = 1; round <= 3; round++) {
    log(`🔄 第${round}轮核心循环开始`);
    const ro = {};

    // A: 架构师
    ro.architect = await agent(
      CORE_ROLES.architect.buildPrompt(standardizedReq, round === 1 ? null : accumulatedContext, round),
      { label: `R${round}-架构师`, phase: '核心循环' }
    );
    log('  🏗️ 架构师完成');

    // B: 工程师
    ro.engineer = await agent(
      CORE_ROLES.engineer.buildPrompt(standardizedReq, ro.architect, round),
      { label: `R${round}-工程师`, phase: '核心循环' }
    );
    log('  👨‍💻 工程师完成');

    // C: 测试员
    ro.tester = await agent(
      CORE_ROLES.tester.buildPrompt(standardizedReq, ro.architect + '\n\n' + ro.engineer, round, prevBugs),
      { label: `R${round}-测试员`, phase: '核心循环' }
    );
    log('  🧪 测试员完成');

    // D: 产品经理
    ro.product = await agent(
      CORE_ROLES.product.buildPrompt(standardizedReq, ro.architect + '\n\n' + ro.engineer + '\n\n' + ro.tester),
      { label: `R${round}-产品经理`, phase: '核心循环' }
    );
    log('  📋 产品经理完成');

    // E: 总结者
    const allCtx = [ro.architect, ro.engineer, ro.tester, ro.product].join('\n\n');
    ro.summarizer = await agent(
      CORE_ROLES.summarizer.buildPrompt(standardizedReq, allCtx, round),
      { label: `R${round}-总结者`, phase: '核心循环' }
    );
    log('  📝 总结者完成');

    // F: 批判者
    ro.critic = await agent(
      CORE_ROLES.critic.buildPrompt(standardizedReq, allCtx + '\n\n' + ro.summarizer, round),
      { label: `R${round}-批判者`, phase: '核心循环' }
    );
    log('  🔥 批判者完成');

    rounds.push(ro);
    accumulatedContext += `\n\n--- 第${round}轮 ---\n${allCtx}\n\n${ro.critic}`;
    prevBugs = ro.tester;

    // 收敛判断
    const hasNewBugs = !ro.tester.includes('无新bug') && !ro.tester.includes('没有发现新bug') && countBugs(ro.tester) > 0;
    const hasNewObj = !ro.critic.includes('无新反对') && !ro.critic.includes('没有新的反对');

    if (!hasNewBugs && !hasNewObj) {
      consecutiveCleanRounds++;
      timeline.push({ round: `第${round}轮`, phase: '核心循环', event: `无新bug，无新反对（连续${consecutiveCleanRounds}轮）` });
    } else {
      consecutiveCleanRounds = 0;
      const ev = [];
      if (hasNewBugs) ev.push(`发现${countBugs(ro.tester)}个新bug`);
      if (hasNewObj) ev.push('批判者有新反对意见');
      timeline.push({ round: `第${round}轮`, phase: '核心循环', event: ev.join('，') });
    }

    log(`  📊 第${round}轮完成：${hasNewBugs ? '有新bug' : '无新bug'}，${hasNewObj ? '有新反对' : '无新反对'}`);

    if (consecutiveCleanRounds >= 2) {
      log(`✅ 核心循环收敛！连续${consecutiveCleanRounds}轮无新问题`);
      break;
    }
    if (round === 3) {
      log('⚠️ 已达最大轮数（3轮），核心循环结束');
    }
  }
  log('');

  // ===== 阶段三：用户评审 =====
  phase('用户评审');

  const codeSummary = rounds.length > 0
    ? `技术方案：\n${rounds[0].architect}\n\n代码实现：\n${rounds[rounds.length - 1].engineer}`
    : '';

  const reviewPromises = USER_ROLES.map(async (role) => {
    const output = await agent(
      role.buildPrompt(standardizedReq, codeSummary),
      { label: `评审-${role.label}`, phase: '用户评审' }
    );
    return { ...role, output };
  });

  const userReviews = await Promise.all(reviewPromises);
  for (const r of userReviews) {
    log(`  ${r.emoji} ${r.label}评审完成`);
  }

  timeline.push({ round: '评审轮', phase: '用户评审', event: `${userReviews.length}个用户角色完成评审` });
  log('');

  // ===== 阶段四：最终整合 =====
  phase('最终整合');

  const allReviewCtx = userReviews.map(r => `### ${r.label}\n${r.output}`).join('\n\n');

  const finalSummary = await agent(
    `你是总结者E。请汇总以下所有内容，生成最终报告。

需求：
${standardizedReq}

核心循环（${rounds.length}轮）：
${rounds.map((r, i) => `--- 第${i+1}轮 ---\n${r.summarizer}`).join('\n\n')}

用户评审：
${allReviewCtx}

请输出：
## 最终总结
### 产品概述
### 技术方案
### 核心功能
### 用户反馈摘要
### 未解决的问题
### 建议的下一步`,
    { label: '最终总结', phase: '最终整合' }
  );
  log('📝 最终总结完成');

  const finalCode = await agent(
    `你是工程师B。请根据以下反馈做最后一轮代码修改。

需求：
${standardizedReq}

当前代码：
${rounds[rounds.length - 1].engineer}

用户评审反馈：
${allReviewCtx}

总结者建议：
${finalSummary}

请只修改需要改的部分，输出修改后的完整代码。`,
    { label: '最终修改', phase: '最终整合' }
  );
  log('👨‍💻 最终代码修改完成');

  // 提取未解决分歧
  const disputes = [];
  if (rounds.length > 0) {
    const lastCritic = rounds[rounds.length - 1].critic || '';
    const sections = lastCritic.split(/####?\s*反对\s*#\d+/);
    for (let i = 1; i < sections.length; i++) {
      const titleMatch = sections[i].match(/^\s*[:：]?\s*(.+)/);
      disputes.push({
        title: titleMatch ? titleMatch[1].trim() : `分歧 #${i}`,
        opinions: [{ role: '批判者', view: sections[i].trim().split('\n')[0] }],
        suggestion: '',
      });
    }
  }

  // 生成报告
  const techStack = rounds.length > 0 ? extractTechStack(rounds[0].architect) : '详见架构方案';
  const report = generateReport({
    requirement: standardizedReq,
    techStack,
    rounds,
    userReviews,
    finalSummary,
    finalCode,
    timeline,
    disputes,
  });

  log('');
  log('🦗 电子斗蛐蛐结束！报告已生成。');

  return { report, rounds: rounds.length, userReviews: userReviews.length };
}

module.exports = { main, meta };
