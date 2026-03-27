# 车辆预约排班系统 - 部署指南

## 项目结构

```
vehicle-booking-system/
├── index.html          # 用户端预约页面
├── user.html           # 用户中心页面
├── schedule.html       # 排班日历页面
├── admin.html          # 管理后台页面
├── apps-script.js      # Google Apps Script 后端代码
└── README.md           # 本文档
```

---

## 已创建的飞书多维表格

| 项目 | 值 |
|------|-----|
| 表格名称 | 车辆预约排班系统 |
| App Token | `EXc0bn58aa5E09seTWGcMGZwnUf` |
| 数据表ID | `tblejyzMhTU4QFOG` |
| 访问链接 | [点击打开](https://c4298iusig.feishu.cn/base/EXc0bn58aa5E09seTWGcMGZwnUf) |

---

## 部署步骤

### 第一步：创建 Google Sheets

1. 打开 [Google Sheets](https://sheets.google.com)
2. 新建空白表格，命名为 `车辆预约系统`
3. 从浏览器地址栏复制 Sheet ID：
   ```
   https://docs.google.com/spreadsheets/d/【这里是SHEET_ID】/edit
   ```

---

### 第二步：部署 Google Apps Script

1. 在 Google Sheets 中，点击 **扩展程序 > Apps Script**
2. 删除默认代码，粘贴 `apps-script.js` 全部内容
3. 修改配置（约第25行）：

```javascript
const CONFIG = {
  SPREADSHEET_ID: '你的SHEET_ID',  // 替换为你的 Sheet ID

  FEISHU: {
    APP_TOKEN: 'EXc0bn58aa5E09seTWGcMGZwnUf',
    TABLE_ID: 'tblejyzMhTU4QFOG',
    APP_ID: 'YOUR_FEISHU_APP_ID',      // 飞书应用ID
    APP_SECRET: 'YOUR_FEISHU_APP_SECRET' // 飞书应用密钥
  }
};
```

4. 选择 `initializeSheets` 函数并运行
5. 点击 **部署 > 新建部署 > 网页应用**
6. 执行身份选"我"，访问权限选"任何人"
7. 复制生成的 URL

---

### 第三步：配置前端

在四个 HTML 文件中，将 `YOUR_GOOGLE_APPS_SCRIPT_URL` 替换为你的 API URL：

| 文件 | 位置 |
|------|------|
| index.html | CONFIG.API_URL |
| user.html | CONFIG.API_URL |
| schedule.html | CONFIG.API_URL |
| admin.html | CONFIG.API_URL |

---

### 第四步：部署前端

**GitHub Pages（推荐）：**
1. 创建 GitHub 仓库
2. 上传所有 HTML 文件
3. Settings > Pages > Source: main
4. 访问 `https://用户名.github.io/仓库名/index.html`

**本地测试：**
```bash
python -m http.server 8080
# 访问 http://localhost:8080/index.html
```

---

## 配置修改

### 修改预约日期范围
```javascript
DATE_RANGE: { start: "2026-04-23", end: "2026-04-30" }
```

### 修改时段选项
```javascript
TIME_SLOTS: [
  { value: "10:00-12:00", label: "10:00 - 12:00" },
  { value: "14:00-16:00", label: "14:00 - 16:00" },
  { value: "17:00-19:00", label: "17:00 - 19:00" }
]
```

### 修改Demo线路
```javascript
DEMO_ROUTES: [
  { value: "顺义短线路1", label: "顺义短线路1" },
  { value: "顺义短线路2", label: "顺义短线路2" }
]
```

### 修改管理密码
在 `admin.html` 中：
```javascript
ADMIN_PASSWORD: "你的新密码"
```

---

## 功能说明

| 页面 | 功能 |
|------|------|
| index.html | 提交预约申请 |
| user.html | 查询/取消预约 |
| schedule.html | 查看排班日历 |
| admin.html | 审批预约（默认密码：admin123） |

---

## 常见问题

**Q: 提交预约显示"网络错误"？**
- 检查 API_URL 是否正确配置
- 确认 Google Apps Script 已部署且访问权限为"任何人"

**Q: 飞书同步失败？**
- 检查飞书应用 APP_ID 和 APP_SECRET
- 确认应用已开通多维表格相关权限

**Q: 如何更新已部署的代码？**
- 在 Apps Script 中修改代码
- 部署 > 管理部署 > 编辑 > 创建新版本
- URL 保持不变