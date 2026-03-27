/**
 * 车辆预约排班系统 - Google Apps Script 后端（含飞书同步）
 *
 * 功能说明：
 * 1. 处理前端API请求
 * 2. Google Sheets数据存储
 * 3. 自动排班算法
 * 4. 飞书多维表格实时同步
 *
 * 部署方式：
 * 1. 打开 Google Sheets
 * 2. 扩展程序 > Apps Script
 * 3. 粘贴此代码
 * 4. 部署 > 新建部署 > 类型选择"网页应用"
 * 5. 执行身份选择"我"，访问权限选择"任何人"
 */

// ========== 配置项 ==========
const CONFIG = {
  // Google Sheets ID（从URL获取，如：https://docs.google.com/spreadsheets/d/SHEET_ID/edit）
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID',

  // 工作表名称
  SHEETS: {
    BOOKINGS: '预约记录',
    VEHICLES: '车辆配置',
    ROUTES: '线路配置',
    SYNC_LOG: '同步日志'
  },

  // 飞书多维表格配置
  FEISHU: {
    APP_TOKEN: 'EXc0bn58aa5E09seTWGcMGZwnUf',
    TABLE_ID: 'tblejyzMhTU4QFOG',
    // 飞书应用凭证（需要在飞书开放平台创建应用获取）
    APP_ID: 'YOUR_FEISHU_APP_ID',
    APP_SECRET: 'YOUR_FEISHU_APP_SECRET'
  },

  // 飞书字段ID映射
  FEISHU_FIELDS: {
    '预约ID': 'fldjVrDRXP',
    '预约日期': 'fldfFntTSf',
    '时段': 'fld9BhTCRZ',
    'Demo线路': 'fldqr3WOf7',
    '客户公司': 'fldFi1L1mn',
    '人数': 'fldHPrODc6',
    '语言': 'fldbiqFRNT',
    '对接人': 'fldfwGEqqr',
    '电话': 'fldfIxMJTQ',
    '备注': 'flddtooZml',
    '状态': 'fldaoWVGFu',
    '车辆': 'fld0J6Ai2u',
    '拒绝原因': 'fld5J6HS1q',
    '创建时间': 'fldza58JSh',
    '更新时间': 'fldvhLrOeW'
  },

  // 车辆数量
  VEHICLE_COUNT: 3,

  // 预约日期范围
  DATE_RANGE: {
    start: '2026-04-24',
    end: '2026-04-30'
  }
};

// 飞书Access Token缓存
let feishuAccessToken = null;
let tokenExpireTime = 0;

// ========== 主入口 - 处理所有请求 ==========

/**
 * GET请求处理 - 支持JSONP绕过CORS
 */
function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback; // JSONP回调函数名

  let result;

  try {
    switch (action) {
      case 'getSchedule':
        result = getSchedule(e.parameter.start, e.parameter.end);
        break;
      case 'getUserBookings':
        result = getUserBookings(e.parameter.phone);
        break;
      case 'getBookingDetail':
        result = getBookingDetail(e.parameter.id);
        break;
      case 'getAllBookings':
        result = getAllBookings();
        break;
      // 新增：通过GET支持的操作（解决CORS问题）
      case 'createBooking':
        result = createBooking(JSON.parse(e.parameter.data));
        break;
      case 'cancelBooking':
        result = cancelBooking(e.parameter.bookingId);
        break;
      case 'approveBooking':
        result = approveBooking(e.parameter.bookingId, e.parameter.status, e.parameter.rejectReason || '');
        break;
      default:
        result = { success: false, message: '未知操作: ' + action };
    }
  } catch (error) {
    result = { success: false, message: error.toString() };
  }

  // 返回JSONP格式或普通JSON
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JAVASCRIPT);

  if (callback) {
    output.setContent(callback + '(' + JSON.stringify(result) + ')');
  } else {
    output.setContent(JSON.stringify(result));
  }

  return output;
}

/**
 * POST请求处理
 */
function doPost(e) {
  let result;

  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      case 'createBooking':
        result = createBooking(data.data);
        break;
      case 'updateBooking':
        result = updateBooking(data.bookingId, data.data);
        break;
      case 'cancelBooking':
        result = cancelBooking(data.bookingId);
        break;
      case 'approveBooking':
        result = approveBooking(data.bookingId, data.status, data.rejectReason);
        break;
      default:
        result = { success: false, message: '未知操作' };
    }
  } catch (error) {
    result = { success: false, message: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== 飞书API封装 ==========

/**
 * 获取飞书Access Token
 */
function getFeishuAccessToken() {
  // 如果token未过期，直接返回
  if (feishuAccessToken && Date.now() < tokenExpireTime) {
    return feishuAccessToken;
  }

  const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
  const payload = {
    app_id: CONFIG.FEISHU.APP_ID,
    app_secret: CONFIG.FEISHU.APP_SECRET
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.code === 0) {
      feishuAccessToken = result.tenant_access_token;
      // 提前5分钟过期
      tokenExpireTime = Date.now() + (result.expire - 300) * 1000;
      return feishuAccessToken;
    } else {
      console.error('获取飞书Token失败:', result);
      return null;
    }
  } catch (error) {
    console.error('获取飞书Token异常:', error);
    return null;
  }
}

/**
 * 同步记录到飞书多维表格
 */
function syncToFeishu(bookingData, recordId = null) {
  try {
    const accessToken = getFeishuAccessToken();
    if (!accessToken) {
      console.log('飞书Token获取失败，跳过同步');
      logSync(bookingData.id, 'error', 'Token获取失败');
      return false;
    }

    // 构建飞书记录字段
    const fields = {};

    // 预约ID
    if (bookingData.id) {
      fields[CONFIG.FEISHU_FIELDS['预约ID']] = bookingData.id;
    }

    // 预约日期（时间戳毫秒）
    if (bookingData.bookingDate) {
      fields[CONFIG.FEISHU_FIELDS['预约日期']] = new Date(bookingData.bookingDate).getTime();
    }

    // 时段（单选）
    if (bookingData.timeSlot) {
      fields[CONFIG.FEISHU_FIELDS['时段']] = bookingData.timeSlot;
    }

    // Demo线路（单选）
    if (bookingData.demoRoute) {
      fields[CONFIG.FEISHU_FIELDS['Demo线路']] = bookingData.demoRoute;
    }

    // 客户公司
    if (bookingData.companyName) {
      fields[CONFIG.FEISHU_FIELDS['客户公司']] = bookingData.companyName;
    }

    // 人数
    if (bookingData.passengerCount) {
      fields[CONFIG.FEISHU_FIELDS['人数']] = parseInt(bookingData.passengerCount);
    }

    // 语言（单选）
    if (bookingData.vehicleLanguage) {
      fields[CONFIG.FEISHU_FIELDS['语言']] = bookingData.vehicleLanguage;
    }

    // 对接人
    if (bookingData.contactName) {
      fields[CONFIG.FEISHU_FIELDS['对接人']] = bookingData.contactName;
    }

    // 电话
    if (bookingData.contactPhone) {
      fields[CONFIG.FEISHU_FIELDS['电话']] = bookingData.contactPhone;
    }

    // 备注
    if (bookingData.remarks) {
      fields[CONFIG.FEISHU_FIELDS['备注']] = bookingData.remarks;
    }

    // 状态（单选）
    const statusMap = {
      'pending': '待审批',
      'approved': '已通过',
      'rejected': '已拒绝',
      'cancelled': '已取消'
    };
    if (bookingData.status) {
      fields[CONFIG.FEISHU_FIELDS['状态']] = statusMap[bookingData.status] || bookingData.status;
    }

    // 车辆
    if (bookingData.vehicleId) {
      fields[CONFIG.FEISHU_FIELDS['车辆']] = bookingData.vehicleId;
    }

    // 拒绝原因
    if (bookingData.rejectReason) {
      fields[CONFIG.FEISHU_FIELDS['拒绝原因']] = bookingData.rejectReason;
    }

    // 创建时间
    if (bookingData.createdAt) {
      fields[CONFIG.FEISHU_FIELDS['创建时间']] = new Date(bookingData.createdAt).getTime();
    }

    // 更新时间
    fields[CONFIG.FEISHU_FIELDS['更新时间']] = Date.now();

    // 构建请求URL
    const baseUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${CONFIG.FEISHU.APP_TOKEN}/tables/${CONFIG.FEISHU.TABLE_ID}/records`;

    let url, method, payload;

    if (recordId) {
      // 更新现有记录
      url = `${baseUrl}/${recordId}`;
      method = 'put';
      payload = { fields: fields };
    } else {
      // 创建新记录
      url = baseUrl;
      method = 'post';
      payload = { fields: fields };
    }

    const options = {
      method: method,
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.code === 0) {
      console.log('飞书同步成功:', bookingData.id);
      logSync(bookingData.id, 'success', recordId ? '更新成功' : '创建成功');
      return true;
    } else {
      console.error('飞书同步失败:', result);
      logSync(bookingData.id, 'error', result.msg || '同步失败');
      return false;
    }

  } catch (error) {
    console.error('飞书同步异常:', error);
    logSync(bookingData.id, 'error', error.toString());
    return false;
  }
}

/**
 * 从飞书查找记录ID
 */
function findFeishuRecordId(bookingId) {
  const accessToken = getFeishuAccessToken();
  if (!accessToken) return null;

  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${CONFIG.FEISHU.APP_TOKEN}/tables/${CONFIG.FEISHU.TABLE_ID}/records/search`;

  const payload = {
    filter: {
      conjunction: 'and',
      conditions: [{
        field_name: '预约ID',
        operator: 'is',
        value: [bookingId]
      }]
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.code === 0 && result.data && result.data.items && result.data.items.length > 0) {
      return result.data.items[0].record_id;
    }
  } catch (error) {
    console.error('查找飞书记录失败:', error);
  }

  return null;
}

/**
 * 记录同步日志
 */
function logSync(bookingId, status, message) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(CONFIG.SHEETS.SYNC_LOG);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEETS.SYNC_LOG);
      sheet.appendRow(['时间', '预约ID', '状态', '消息']);
    }

    sheet.appendRow([new Date(), bookingId, status, message]);
  } catch (error) {
    console.error('记录日志失败:', error);
  }
}

// ========== 数据库操作 ==========

/**
 * 获取预约表
 */
function getBookingSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEETS.BOOKINGS);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.BOOKINGS);
    const headers = [
      'ID', '创建时间', '预约日期', '时段', 'Demo线路',
      '客户公司名称', '上车人数', '车辆语言', '对接人姓名',
      '对接人电话', '备注', '状态', '车辆ID', '拒绝原因', '更新时间', '飞书记录ID'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * 获取所有预约数据
 */
function getAllBookings() {
  const sheet = getBookingSheet();
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return { success: true, data: [] };
  }

  const bookings = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) {
      // 标准化日期格式
      let bookingDate = row[2];
      if (bookingDate instanceof Date) {
        bookingDate = Utilities.formatDate(bookingDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }

      bookings.push({
        id: row[0],
        createdAt: row[1],
        bookingDate: bookingDate,
        timeSlot: row[3],
        demoRoute: row[4],
        companyName: row[5],
        passengerCount: row[6],
        vehicleLanguage: row[7],
        contactName: row[8],
        contactPhone: row[9],
        remarks: row[10],
        status: row[11],
        vehicleId: row[12],
        rejectReason: row[13],
        updatedAt: row[14],
        feishuRecordId: row[15]
      });
    }
  }

  return { success: true, data: bookings };
}

/**
 * 创建新预约
 */
function createBooking(bookingData) {
  const sheet = getBookingSheet();

  // 验证必填字段
  const requiredFields = ['bookingDate', 'timeSlot', 'demoRoute', 'companyName',
                          'passengerCount', 'vehicleLanguage', 'contactName', 'contactPhone'];
  for (const field of requiredFields) {
    if (!bookingData[field]) {
      return { success: false, message: `缺少必填字段: ${field}` };
    }
  }

  // 检查日期范围
  const bookingDate = new Date(bookingData.bookingDate);
  const startDate = new Date(CONFIG.DATE_RANGE.start);
  const endDate = new Date(CONFIG.DATE_RANGE.end);

  if (bookingDate < startDate || bookingDate > endDate) {
    return { success: false, message: '预约日期不在有效范围内' };
  }

  // 检查时段是否已满
  const capacityCheck = checkTimeSlotCapacity(bookingData.bookingDate, bookingData.timeSlot);
  if (!capacityCheck.available) {
    return { success: false, message: '该时段已约满，请选择其他时段' };
  }

  // 生成唯一ID
  const id = 'BK' + Utilities.formatDate(new Date(), 'Asia/Shanghai', 'yyyyMMddHHmmss') +
             Math.random().toString(36).substr(2, 4).toUpperCase();

  const now = new Date();

  // 写入Google Sheets
  const newRow = [
    id, now, bookingData.bookingDate, bookingData.timeSlot, bookingData.demoRoute,
    bookingData.companyName, bookingData.passengerCount, bookingData.vehicleLanguage,
    bookingData.contactName, bookingData.contactPhone, bookingData.remarks || '',
    'pending', '', '', now, ''
  ];

  sheet.appendRow(newRow);

  // 同步到飞书
  const fullBookingData = {
    ...bookingData,
    id: id,
    status: 'pending',
    createdAt: now
  };

  // 异步同步到飞书（不阻塞主流程）
  syncToFeishuBackground(fullBookingData);

  return {
    success: true,
    message: '预约申请已提交，请等待审批',
    bookingId: id
  };
}

/**
 * 后台同步到飞书（使用触发器）
 */
function syncToFeishuBackground(bookingData) {
  // 先尝试同步
  syncToFeishu(bookingData);
}

/**
 * 检查时段容量
 */
function checkTimeSlotCapacity(date, timeSlot) {
  const result = getAllBookings();
  const bookings = result.data;

  const count = bookings.filter(b =>
    b.bookingDate === date &&
    b.timeSlot === timeSlot &&
    (b.status === 'approved' || b.status === 'pending')
  ).length;

  return {
    available: count < CONFIG.VEHICLE_COUNT,
    remaining: CONFIG.VEHICLE_COUNT - count
  };
}

/**
 * 获取用户预约
 */
function getUserBookings(phone) {
  const result = getAllBookings();
  const bookings = result.data.filter(b => b.contactPhone === phone);

  return {
    success: true,
    data: bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  };
}

/**
 * 获取预约详情
 */
function getBookingDetail(id) {
  const result = getAllBookings();
  const booking = result.data.find(b => b.id === id);

  if (booking) {
    return { success: true, data: booking };
  } else {
    return { success: false, message: '预约不存在' };
  }
}

/**
 * 更新预约
 */
function updateBooking(bookingId, updateData) {
  const sheet = getBookingSheet();
  const data = sheet.getDataRange().getValues();

  let rowIndex = -1;
  let currentBooking = null;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === bookingId) {
      rowIndex = i + 1;
      currentBooking = {
        status: data[i][11],
        bookingDate: data[i][2],
        timeSlot: data[i][3],
        demoRoute: data[i][4],
        companyName: data[i][5],
        passengerCount: data[i][6],
        vehicleLanguage: data[i][7],
        contactName: data[i][8],
        contactPhone: data[i][9],
        remarks: data[i][10],
        feishuRecordId: data[i][15]
      };
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, message: '预约不存在' };
  }

  if (currentBooking.status !== 'pending') {
    return { success: false, message: '只能修改待审批的预约' };
  }

  if (updateData.bookingDate || updateData.timeSlot) {
    const newDate = updateData.bookingDate || currentBooking.bookingDate;
    const newSlot = updateData.timeSlot || currentBooking.timeSlot;

    if (newDate !== currentBooking.bookingDate || newSlot !== currentBooking.timeSlot) {
      const capacityCheck = checkTimeSlotCapacity(newDate, newSlot);
      if (!capacityCheck.available) {
        return { success: false, message: '新时段已约满' };
      }
    }
  }

  const colMap = {
    bookingDate: 3, timeSlot: 4, demoRoute: 5, companyName: 6,
    passengerCount: 7, vehicleLanguage: 8, remarks: 11
  };

  for (const [key, col] of Object.entries(colMap)) {
    if (updateData[key] !== undefined) {
      sheet.getRange(rowIndex, col).setValue(updateData[key]);
    }
  }

  const now = new Date();
  sheet.getRange(rowIndex, 15).setValue(now);

  // 同步到飞书
  const updatedBooking = { ...currentBooking, ...updateData, updatedAt: now, id: bookingId };
  syncToFeishu(updatedBooking, currentBooking.feishuRecordId);

  return { success: true, message: '修改成功' };
}

/**
 * 取消预约
 */
function cancelBooking(bookingId) {
  const sheet = getBookingSheet();
  const data = sheet.getDataRange().getValues();

  let rowIndex = -1;
  let feishuRecordId = null;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === bookingId) {
      rowIndex = i + 1;
      feishuRecordId = data[i][15];
      if (data[i][11] !== 'pending') {
        return { success: false, message: '只能取消待审批的预约' };
      }
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, message: '预约不存在' };
  }

  sheet.getRange(rowIndex, 12).setValue('cancelled');
  sheet.getRange(rowIndex, 15).setValue(new Date());
  sheet.getRange(rowIndex, 13).setValue('');

  // 同步到飞书
  syncToFeishu({ id: bookingId, status: 'cancelled', updatedAt: new Date() }, feishuRecordId);

  return { success: true, message: '已取消预约' };
}

/**
 * 审批预约
 */
function approveBooking(bookingId, status, rejectReason) {
  const sheet = getBookingSheet();
  const data = sheet.getDataRange().getValues();

  let rowIndex = -1;
  let currentBooking = null;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === bookingId) {
      rowIndex = i + 1;
      currentBooking = {
        bookingDate: data[i][2],
        timeSlot: data[i][3],
        status: data[i][11],
        feishuRecordId: data[i][15]
      };
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, message: '预约不存在' };
  }

  if (currentBooking.status !== 'pending') {
    return { success: false, message: '该预约已处理' };
  }

  const now = new Date();

  sheet.getRange(rowIndex, 12).setValue(status);
  sheet.getRange(rowIndex, 15).setValue(now);

  let vehicleId = '';

  if (status === 'rejected') {
    sheet.getRange(rowIndex, 14).setValue(rejectReason);
  } else if (status === 'approved') {
    vehicleId = assignVehicle(currentBooking.bookingDate, currentBooking.timeSlot);
    sheet.getRange(rowIndex, 13).setValue(vehicleId || '待分配');
  }

  // 同步到飞书
  syncToFeishu({
    id: bookingId,
    status: status,
    rejectReason: rejectReason || '',
    vehicleId: vehicleId,
    updatedAt: now
  }, currentBooking.feishuRecordId);

  return {
    success: true,
    message: status === 'approved' ? '审批通过' : '已拒绝',
    vehicleId: vehicleId
  };
}

/**
 * 自动排班：分配车辆
 */
function assignVehicle(date, timeSlot) {
  // 标准化日期格式
  let targetDate;
  if (date instanceof Date) {
    targetDate = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } else {
    targetDate = String(date).split('T')[0]; // 处理 ISO 格式
  }

  const result = getAllBookings();
  const bookings = result.data;

  const occupiedVehicles = new Set();
  bookings.forEach(b => {
    // 标准化预约日期
    let bookingDateStr;
    if (b.bookingDate instanceof Date) {
      bookingDateStr = Utilities.formatDate(b.bookingDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else {
      bookingDateStr = String(b.bookingDate).split('T')[0];
    }

    if (bookingDateStr === targetDate &&
        b.timeSlot === timeSlot &&
        b.status === 'approved' &&
        b.vehicleId) {
      occupiedVehicles.add(b.vehicleId);
    }
  });

  for (let i = 1; i <= CONFIG.VEHICLE_COUNT; i++) {
    const vehicleId = `车辆${i}`;
    if (!occupiedVehicles.has(vehicleId)) {
      return vehicleId;
    }
  }

  return null;
}

/**
 * 获取排班数据
 */
function getSchedule(startDate, endDate) {
  const result = getAllBookings();
  const bookings = result.data.filter(b =>
    b.status === 'approved' || b.status === 'pending'
  );

  return { success: true, data: bookings };
}

// ========== 初始化脚本 ==========

/**
 * 初始化Google Sheets表结构
 */
function initializeSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  // 创建预约记录表
  let bookingSheet = ss.getSheetByName(CONFIG.SHEETS.BOOKINGS);
  if (!bookingSheet) {
    bookingSheet = ss.insertSheet(CONFIG.SHEETS.BOOKINGS);
    const headers = [
      'ID', '创建时间', '预约日期', '时段', 'Demo线路',
      '客户公司名称', '上车人数', '车辆语言', '对接人姓名',
      '对接人电话', '备注', '状态', '车辆ID', '拒绝原因', '更新时间', '飞书记录ID'
    ];
    bookingSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    bookingSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f4f6');
    bookingSheet.setFrozenRows(1);
    bookingSheet.setColumnWidth(1, 120);
    bookingSheet.setColumnWidth(3, 100);
    bookingSheet.setColumnWidth(6, 150);
    bookingSheet.setColumnWidth(10, 120);
  }

  // 创建车辆配置表
  let vehicleSheet = ss.getSheetByName(CONFIG.SHEETS.VEHICLES);
  if (!vehicleSheet) {
    vehicleSheet = ss.insertSheet(CONFIG.SHEETS.VEHICLES);
    vehicleSheet.appendRow(['车辆ID', '车辆名称', '状态', '备注']);
    for (let i = 1; i <= CONFIG.VEHICLE_COUNT; i++) {
      vehicleSheet.appendRow([`车辆${i}`, `Demo车辆${i}`, '可用', '']);
    }
  }

  // 创建线路配置表
  let routeSheet = ss.getSheetByName(CONFIG.SHEETS.ROUTES);
  if (!routeSheet) {
    routeSheet = ss.insertSheet(CONFIG.SHEETS.ROUTES);
    routeSheet.appendRow(['线路ID', '线路名称', '描述', '状态']);
    routeSheet.appendRow(['顺义短线路1', '顺义短线路1', '顺义短途测试线路1', '启用']);
    routeSheet.appendRow(['顺义短线路2', '顺义短线路2', '顺义短途测试线路2', '启用']);
  }

  console.log('初始化完成！');
}

/**
 * 测试飞书连接
 */
function testFeishuConnection() {
  const token = getFeishuAccessToken();
  if (token) {
    console.log('飞书连接成功，Token:', token.substring(0, 10) + '...');
  } else {
    console.log('飞书连接失败，请检查APP_ID和APP_SECRET配置');
  }
}

/**
 * 全量同步到飞书
 */
function syncAllToFeishu() {
  const result = getAllBookings();
  const bookings = result.data;

  let successCount = 0;
  let failCount = 0;

  bookings.forEach(booking => {
    const success = syncToFeishu(booking, booking.feishuRecordId);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    Utilities.sleep(200); // 避免频率限制
  });

  console.log(`同步完成: 成功 ${successCount} 条，失败 ${failCount} 条`);
}