/* Used only to read and export responses from the previous questionnaire. */
const previousSections = [
  [
    {id: "household", title: "谁和你一起使用家里的公共空间？", options: ["独居", "两人伴侣", "育儿家庭，有婴幼儿", "与室友或其他家人同住", "其他"]},
    {id: "age", title: "你的年龄在哪个区间？", options: ["18–21 岁", "22–24 岁", "25–27 岁", "28–34 岁", "35 岁及以上", "不方便透露"]},
    {id: "work", title: "平时的工作或学习节奏是怎样的？", optional: true},
    {id: "housing", title: "你现在的住处可以怎样调整？", options: ["租住，只能挪动家具", "租住，经同意可局部改动", "自有或家人住房", "宿舍或合住，需先协商", "其他"]},
    {id: "pet", title: "这次主要回答的是哪一只宠物？", options: ["一只猫", "多宠家庭中的一只猫", "一只狗", "多宠家庭中的一只狗", "其他宠物"]},
    {id: "area", title: "日常可供宠物活动的室内面积大约是多少？", options: ["不到 30 ㎡", "30–59 ㎡", "60–89 ㎡", "90 ㎡及以上", "估不准"]},
  ],
  [
    {id: "bed", title: "你为它准备的窝或垫子主要放在哪里？", options: ["客厅", "卧室或书房", "阳台或其他位置", "常移动", "没有专用窝垫"]},
    {id: "rest", title: "昨天它休息最久的地方是哪里？", options: ["准备好的窝垫", "沙发或人的床", "窗边或地面", "其他", "没观察到"]},
    {id: "feeding", title: "上一次添食是在家中哪个位置？", options: ["厨房或操作台附近", "客厅或餐区", "卧室或书房", "阳台或其他", "无固定位置"]},
    {id: "water", title: "水碗或饮水机与食盆的关系是？", options: ["同一张垫上", "同一房间的不同位置", "分在两个房间", "随时移动", "没有单设饮水处"]},
    {id: "storage", title: "开封后的主粮平时放在哪里？", options: ["厨房柜内", "食盆旁有盖粮桶", "其他房间或储藏柜", "原包装放在地上", "其他"]},
    {id: "toilet", title: "它最常使用的如厕位置在哪里？", options: ["卫生间", "阳台或洗衣区", "客厅边角或玄关", "卧室或其他位置", "主要在户外"]},
    {id: "days", title: "过去 7 天，你有几天在走路时需要侧身、跨过或绕开宠物用品？", options: ["0 天", "1–2 天", "3–4 天", "5–7 天", "记不清"]},
    {id: "incident", title: "请还原最近一次添粮、清砂或洗碗的路线。哪一步最费事？"},
  ],
  [
    {id: "moved", title: "过去半年，最近一次挪动了哪样宠物用品？", options: ["窝或垫子", "食盆或饮水机", "猫砂盆或尿垫", "储粮容器", "没有挪动过"]},
    {id: "trigger", title: "当时发生了什么，让你决定换位置？", options: ["走路容易碰到", "打扫或添食费劲", "宠物很少使用", "同住者的作息发生变化", "家具或住处改变", "其他"], when: a => a.moved !== '没有挪动过'},
    {id: "outcome", title: "试过新位置后，东西最后放在哪里？", options: ["保留新位置", "挪回原处", "又试了第三处", "还在观察"], when: a => a.moved !== '没有挪动过'},
    {id: "tradeoff", title: "选位置时，你最舍不得牺牲什么？为什么？"},
    {id: "limit", title: "如果明天就调整，最大的现实限制是什么？", options: ["地面空间不够", "租房不能改造", "预算", "同住者也要使用这里", "宠物习惯固定", "暂时没有限制"]},
    {id: "focus", title: "如果只改善一处，你会先动哪里？", options: ["休息区", "进食饮水区", "如厕区", "储粮区", "家里的通道", "暂时维持现状"]},
  ],
  [
    {id: "bedtest", title: "模型里猫窝预留了 50 × 40 cm。你会先怎样验证这个位置？", options: ["用纸胶带贴出占地", "拿自家猫窝实摆", "先完全打开旁边的门", "先观察猫更喜欢在哪里睡", "暂时无法判断"]},
    {id: "traytest", title: "如果把猫砂盆试放在玄关一侧，哪件事会改变你的决定？", options: ["开门或放鞋时挡住通道", "清砂后去倒垃圾太远", "宠物不习惯有人经过", "扫落砂不方便", "对我家不适用"]},
    {id: "bowltest", title: "看双碗和储粮桶时，你会先跟着哪条路线走一次？", options: ["粮桶到食盆", "水碗到水槽", "人从厨房端饭到沙发", "抱孩子或推车经过", "我家有另一条路线"]},
    {id: "caseReason", title: "四个位置里，选一个愿意先试或先改的，说说理由。"},
    {id: "evidence", title: "要把这套方案搬到自己家，你最想先补充哪份信息？", options: ["自家用品外尺寸", "门扇全开的范围", "通道最窄处的宽度", "宠物平常停留的位置", "其他"]},
  ],
  [
    {id: "feature", title: "如果只能先做一个功能，你会选哪一个？", options: ["按自家用品尺寸试摆", "对比两个位置", "查看剩余通行空间", "与家人分享方案", "其他或暂时用不上"]},
    {id: "whyFeature", title: "请用家里的一件具体物品说明，你会怎样用刚选的功能。"},
    {id: "privacy", title: "考虑扫描自己的房间时，你最在意什么？", options: ["影像能否只存在本机", "能否遮住私人物品", "设备是否支持", "扫描需要多久", "尺寸误差", "没有明显顾虑"]},
    {id: "trial", title: "如果有 10 分钟可以试用，你愿意做哪一步？", options: ["用已有案例试一次", "用自己的房间试摆", "先看别人示范", "暂时不想尝试"]},
    {id: "extra", title: "还有哪个场景、用品或例外情况是上面没问到的？", optional: true},
  ],
];
const previousQuestions = previousSections.flat();
const previousChapters = ['同住的人和宠物','一天里的四个位置','回到上一次挪动用品','一起看这间客厅','你会怎样使用 PawSpace'];

// Keep the wording and branching of previously submitted v2 records.
const v2PlanningQuestions = [
  {id: "dimensions", title: "如果今天要试摆一件已有用品，您能从哪里得到它的外部尺寸？", options: ["手头已有尺寸记录", "可以用尺测量", "可以查商品规格", "只能大致估计", "目前没有合适用品", "说不准"]},
  {id: "limit", title: "如果明天就调整，最大的现实限制是什么？", options: ["地面空间不够", "租房不能改造", "预算", "同住者也要使用这里", "宠物习惯固定", "暂时没有限制"]},
  {id: "plan", title: "未来一年，您已打算为宠物区域做的最大改动是什么？", options: ["只调整已有用品的位置", "添置或更换可移动用品", "局部施工", "搬家或全屋装修时重新布置", "没有改动打算", "尚未决定"]},
  {id: "renovation", title: "在这次装修或搬家布置中，您会优先改哪一处？", options: ["地面防滑", "墙面或地面易清洁", "宠物厕所附近通风", "柜内收纳空间", "门或隔断的通行空间", "其他改动", "还没有优先项"], when: a => ["局部施工", "搬家或全屋装修时重新布置"].includes(a.plan)},
  {id: "evidence", title: "决定自己家一个新位置之前，您最需要确认哪项信息？", options: ["自家用品外尺寸", "门扇全开的范围", "通道最窄处的宽度", "宠物平常停留的位置", "清洁时人需要的空间", "其他", "暂时不需要更多信息"]},
  {id: "view", title: "比较自家两个摆放位置时，您最希望先看到哪种视图？", options: ["带尺寸的平面图", "保留家具纹理的实景扫描", "可旋转的简化三维房间", "两个位置的并排照片", "直接拿实物试就够了", "说不准"]},
  {id: "feature", title: "如果只能先做一个功能，你会选哪一个？", options: ["按自家用品尺寸试摆", "对比两个位置", "查看剩余通行空间", "与家人分享方案", "其他功能", "暂时用不上", "说不准"]}
];
const v3Sections = [[{id: "household", title: "谁和你一起使用家里的公共空间？", options: ["独居", "两人伴侣", "育儿家庭，有婴幼儿", "与室友或其他家人同住", "其他"]}, ...sections[0].slice(6)], ...sections.slice(1)];
const v2Sections = [...v3Sections.slice(0, 3), [{id: "focus", title: "如果只改善一处，你会先动哪里？", options: ["休息区", "进食饮水区", "如厕区", "储粮区", "家里的通道", "暂时维持现状"]}, ...v2PlanningQuestions.slice(0, 4)], [...v2PlanningQuestions.slice(4), ...sections[4].slice(3)]];
const surveyVersions = {
  "pawspace-response-v1": {source:"previous", sections:previousSections, chapters:previousChapters, questions:previousQuestions},
  "pawspace-response-v2": {source:"v2", sections:v2Sections, chapters:[...chapters.slice(0,3).map(c=>c[0]), "想改哪里，能改多少", "试摆工具能帮上什么忙"], questions:v2Sections.flat()},
  "pawspace-response-v3": {source:"v3", sections:v3Sections, chapters:chapters.map(c=>c[0]), questions:v3Sections.flat()},
  "pawspace-response-v4": {source:"live", sections, chapters:chapters.map(c=>c[0]), questions}
};
