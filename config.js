// config.js - 电子斗蛐蛐：配置

module.exports = {
  // 最大核心循环轮数
  MAX_CORE_ROUNDS: 3,

  // 收敛条件：连续N轮无新问题
  CONVERGENCE_THRESHOLD: 2,

  // 项目输出根目录
  OUTPUT_ROOT: './output',

  // Agent 标签前缀
  AGENT_PREFIX: '蛐蛐',

  // 用户评审角色数量（第一版固定5个）
  USER_REVIEW_COUNT: 5,
};
