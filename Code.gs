/**
 * ============================================================
 * SCREENING CV OTOMATIS — Gmail Intake + Claude Batch API
 * + Dashboard Analytics untuk Looker Studio
 * ============================================================
 */

// ====== KONFIGURASI ======
function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    CLAUDE_API_KEY: props.getProperty('CLAUDE_API_KEY'),
    TELEGRAM_BOT_TOKEN: props.getProperty('TELEGRAM_BOT_TOKEN'),
    TELEGRAM_CHAT_ID: props.getProperty('TELEGRAM_CHAT_ID'),
    CLAUDE_MODEL: 'claude-sonnet-4-6',
    GMAIL_LABEL_MASUK: 'CV-Masuk',
    GMAIL_LABEL_SELESAI: 'CV-Diproses',
    DRIVE_FOLDER_NAME: 'CV Kandidat',
    SHEET_KANDIDAT: 'Kandidat',
    SHEET_KRITERIA: 'Kriteria Penilaian',
    SHEET_HASIL: 'Hasil Screening',
    SHEET_ANALYTICS: 'Analytics Data'
  };
}

// ============================================================
// ===== UTILITAS UMUM =====
// ============================================================

function getOrCreateDriveFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

// ============================================================
// ===== 1. INTAKE DARI GMAIL =====
// ============================================================

function intakeFromGmail() {
  var config = getConfig();
  var folder = getOrCreateDriveFolder(config.DRIVE_FOLDER_NAME);
  var sheet = getOrCreateSheet(config.SHEET_KANDIDAT, [
    'Tanggal Masuk', 'Nama Pengirim', 'Email Pengirim', 'Subjek',
    'Nama File CV', 'Drive File ID', 'Status'
  ]);

  var labelMasuk = GmailApp.getUserLabelByName(config.GMAIL_LABEL_MASUK);
  if (!labelMasuk) {
    Logger.log('Label Gmail "' + config.GMAIL_LABEL_MASUK + '" belum ada.');
    return;
  }

  var labelSelesai = GmailApp.getUserLabelByName(config.GMAIL_LABEL_SELESAI);
  if (!labelSelesai) {
    labelSelesai = GmailApp.createLabel(config.GMAIL_LABEL_SELESAI);
  }

  var threads = labelMasuk.getThreads();
  var jumlahBaru = 0;

  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t];
    var messages = thread.getMessages();

    for (var m = 0; m < messages.length; m++) {
      var message = messages[m];
      var attachments = message.getAttachments();
      var pdfAttachments = [];

      for (var a = 0; a < attachments.length; a++) {
        if (attachments[a].getContentType() === 'application/pdf') {
          pdfAttachments.push(attachments[a]);
        }
      }

      if (pdfAttachments.length === 0) continue;

      var senderName = message.getFrom().replace(/<.*>/, '').trim();
      var senderEmailMatch = message.getFrom().match(/<(.+)>/);
      var senderEmail = senderEmailMatch ? senderEmailMatch[1] : message.getFrom();
      var subject = message.getSubject();
      var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

      for (var p = 0; p < pdfAttachments.length; p++) {
        var file = folder.createFile(pdfAttachments[p]);
        sheet.appendRow([today, senderName, senderEmail, subject, file.getName(), file.getId(), 'Baru']);
        jumlahBaru++;
      }
    }

    thread.removeLabel(labelMasuk);
    thread.addLabel(labelSelesai);
  }

  Logger.log('Intake selesai. ' + jumlahBaru + ' CV baru ditambahkan.');
}

// ============================================================
// ===== 2. EKSTRAKSI TEKS =====
// ============================================================

function extractPdfText(fileId) {
  // METODE 1: Coba buka langsung sebagai Google Doc.
  try {
    var doc = DocumentApp.openById(fileId);
    var text = doc.getBody().getText();
    if (text && text.trim().length > 0) {
      Logger.log('Berhasil baca teks langsung: ' + text.length + ' karakter');
      return text;
    }
  } catch (e) {
    Logger.log('DocumentApp.openById gagal untuk ' + fileId + ': ' + e.message);
  }

  // METODE 2: Download file lalu OCR dengan mimeType PDF
  var file = DriveApp.getFileById(fileId);
  var blob = file.getBlob();
  for (var attempt = 1; attempt <= 3; attempt++) {
    var delayMs = attempt * 5000;
    Logger.log('OCR attempt ' + attempt + '/3, delay ' + (delayMs/1000) + ' detik...');
    Utilities.sleep(delayMs);
    try {
      var resource = {
        title: 'temp_ocr_' + fileId + '_' + attempt,
        mimeType: 'application/pdf'
      };
      var tempDocId = null;
      try {
        var docFile = Drive.Files.insert(resource, blob, { ocr: true, ocrLanguage: 'en' });
        tempDocId = docFile.id;
        var ocrDoc = DocumentApp.openById(tempDocId);
        var ocrText = ocrDoc.getBody().getText();
        if (ocrText && ocrText.trim().length > 0) {
          Logger.log('OCR berhasil (attempt ' + attempt + '): ' + ocrText.length + ' karakter');
          return ocrText;
        }
      } catch (e3) {
        Logger.log('OCR attempt ' + attempt + ' gagal: ' + e3.message);
      } finally {
        if (tempDocId) {
          try { DriveApp.getFileById(tempDocId).setTrashed(true); } catch (ex) {}
        }
      }
    } catch (e4) {
      Logger.log('OCR attempt ' + attempt + ' error: ' + e4.message);
    }
  }

  Logger.log('Semua metode gagal untuk file ' + fileId);
  return '';
}

// ============================================================
// ===== 3. KRITERIA PENILAIAN (dari Sheet) =====
// ============================================================

function getCriteriaText() {
  var config = getConfig();
  var sheet = getOrCreateSheet(config.SHEET_KRITERIA, ['Kriteria', 'Bobot (%)', 'Deskripsi']);
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) rows.push(data[i]);
  }

  if (rows.length === 0) return null;

  var totalBobot = 0;
  for (var j = 0; j < rows.length; j++) {
    totalBobot += (parseFloat(rows[j][1]) || 0);
  }
  if (totalBobot !== 100) {
    Logger.log('Peringatan: Total bobot = ' + totalBobot + '% (seharusnya 100%).');
  }

  var result = '';
  for (var k = 0; k < rows.length; k++) {
    result += '- ' + rows[k][0] + ' (bobot ' + rows[k][1] + '%): ' + rows[k][2];
    if (k < rows.length - 1) result += '\n';
  }
  return result;
}

// ============================================================
// ===== 4. SUSUN & KIRIM BATCH =====
// ============================================================

function buildAndSubmitBatch() {
  var config = getConfig();

  var existingBatchId = PropertiesService.getScriptProperties().getProperty('CURRENT_BATCH_ID');
  if (existingBatchId) {
    Logger.log('Masih ada batch berjalan (' + existingBatchId + '). Tunggu selesai.');
    return;
  }

  var criteriaText = getCriteriaText();
  if (!criteriaText) {
    Logger.log('Kriteria penilaian belum diisi.');
    return;
  }

  var sheet = getOrCreateSheet(config.SHEET_KANDIDAT, [
    'Tanggal Masuk', 'Nama Pengirim', 'Email Pengirim', 'Subjek',
    'Nama File CV', 'Drive File ID', 'Status'
  ]);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var statusCol = headers.indexOf('Status');
  var fileIdCol = headers.indexOf('Drive File ID');

  var kandidatBaru = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][statusCol] === 'Baru') {
      kandidatBaru.push({ rowIndex: i + 1, fileId: data[i][fileIdCol] });
    }
  }

  if (kandidatBaru.length === 0) {
    Logger.log('Tidak ada kandidat berstatus "Baru".');
    return;
  }

  var requests = [];
  var processedRows = [];

  for (var j = 0; j < kandidatBaru.length; j++) {
    var k = kandidatBaru[j];
    var cvText = extractPdfText(k.fileId);
    if (!cvText) {
      Logger.log('Gagal ekstrak teks untuk file ' + k.fileId);
      sheet.getRange(k.rowIndex, statusCol + 1).setValue('OCR Gagal');
      continue;
    }

    var prompt = 'Kamu adalah asisten screening rekrutmen.\n\n'
      + 'Berikut isi CV kandidat:\n\n'
      + '===== ISI CV =====\n'
      + cvText.slice(0, 8000)
      + '\n===== AKHIR CV =====\n\n'
      + 'Kriteria penilaian untuk posisi ini:\n'
      + criteriaText
      + '\n\nATURAN PENTING:\n'
      + '1. Nilai HANYA berdasarkan pengalaman kerja, keahlian teknis, pendidikan, dan pencapaian terukur.\n'
      + '2. ABAIKAN nama, usia, gender, foto, status pernikahan, agama.\n'
      + '3. Jangan mengarang informasi yang tidak ada di CV.\n'
      + '4. Analisis skill gap: bandingkan keahlian yang terbukti ada di CV dengan tiap kriteria.\n'
      + '5. Susun 3-5 pertanyaan interview yang SPESIFIK.\n'
      + '6. Ekstrak data terstruktur dari CV untuk keperluan analytics.\n\n'
      + 'RESPONSE HARUS BERUPA JSON SAJA, tanpa teks lain, tanpa markdown fence.\n'
      + 'Format:\n'
      + '{"skor_total":75,"skor_per_kriteria":{"Pengalaman relevan":80},"kekuatan":"ringkasan","kekhawatiran":"ringkasan","rekomendasi":"Lanjut ke interview","skill_gap":[{"kriteria":"Pendidikan","status":"Sebagian","catatan":"belum ada bukti S1"}],"pertanyaan_interview":["pertanyaan 1","pertanyaan 2"],"data_cv":{"kota_asal":"Jakarta","tahun_pengalaman":5,"pendidikan_terakhir":"S1","jurusan":"Informatika","skills":"Python, SQL, Tableau","tanggal_lahir":"","status_pernikahan":""}}';

    requests.push({
      custom_id: k.fileId,
      params: {
        model: config.CLAUDE_MODEL,
        max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }]
      }
    });

    sheet.getRange(k.rowIndex, statusCol + 1).setValue('Menunggu Batch');
    processedRows.push(k.rowIndex);
  }

  if (requests.length === 0) {
    Logger.log('Tidak ada request valid.');
    return;
  }

  var url = 'https://api.anthropic.com/v1/messages/batches';
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': config.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify({ requests: requests }),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var body = JSON.parse(response.getContentText());

  if (code !== 200) {
    Logger.log('Gagal submit batch (HTTP ' + code + '): ' + response.getContentText());
    for (var r = 0; r < processedRows.length; r++) {
      sheet.getRange(processedRows[r], statusCol + 1).setValue('Baru');
    }
    return;
  }

  PropertiesService.getScriptProperties().setProperty('CURRENT_BATCH_ID', body.id);
  Logger.log('Batch berhasil! ID: ' + body.id + ', kandidat: ' + requests.length);
}

// ============================================================
// ===== 5. CEK STATUS & AMBIL HASIL BATCH =====
// ============================================================

function checkBatchStatus() {
  var config = getConfig();
  var batchId = PropertiesService.getScriptProperties().getProperty('CURRENT_BATCH_ID');

  if (!batchId) {
    Logger.log('Tidak ada batch berjalan.');
    return;
  }

  var url = 'https://api.anthropic.com/v1/messages/batches/' + batchId;
  var options = {
    method: 'get',
    headers: {
      'x-api-key': config.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code !== 200) {
    Logger.log('Gagal cek status (HTTP ' + code + ')');
    return;
  }

  var batch = JSON.parse(response.getContentText());
  Logger.log('Status batch ' + batchId + ': ' + batch.processing_status);

  if (batch.processing_status !== 'ended') return;

  var success = retrieveBatchResults(batch.results_url);
  PropertiesService.getScriptProperties().deleteProperty('CURRENT_BATCH_ID');
  Logger.log('Batch selesai. ' + (success ? 'Berhasil.' : 'Gagal.'));
}

function retrieveBatchResults(resultsUrl) {
  var config = getConfig();
  var options = {
    method: 'get',
    headers: {
      'x-api-key': config.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(resultsUrl, options);
  if (response.getResponseCode() !== 200) {
    Logger.log('Gagal ambil hasil.');
    return false;
  }

  var lines = response.getContentText().trim().split('\n');

  var kandidatSheet = getOrCreateSheet(config.SHEET_KANDIDAT, [
    'Tanggal Masuk', 'Nama Pengirim', 'Email Pengirim', 'Subjek',
    'Nama File CV', 'Drive File ID', 'Status'
  ]);
  var kandidatData = kandidatSheet.getDataRange().getValues();
  var headers = kandidatData[0];
  var fileIdCol = headers.indexOf('Drive File ID');
  var statusCol = headers.indexOf('Status');
  var namaCol = headers.indexOf('Nama Pengirim');
  var emailCol = headers.indexOf('Email Pengirim');
  var subjekCol = headers.indexOf('Subjek');
  var tanggalCol = headers.indexOf('Tanggal Masuk');

  var hasilSheet = getOrCreateSheet(config.SHEET_HASIL, [
    'Nama Kandidat', 'Email', 'Skor Total', 'Kekuatan', 'Kekhawatiran',
    'Rekomendasi', 'Detail Skor', 'Skill Gap', 'Pertanyaan', 'Drive File ID'
  ]);

  // Sheet baru untuk analytics / Looker Studio
  var analyticsSheet = getOrCreateSheet(config.SHEET_ANALYTICS, [
    'Tanggal Screening', 'Nama Kandidat', 'Email', 'Subjek Lamaran',
    'Kota Asal', 'Tahun Pengalaman', 'Pendidikan Terakhir', 'Jurusan',
    'Skills', 'Skor Total', 'Rekomendasi', 'Drive File ID'
  ]);

  var hasilBaru = [];
  var analyticsBaru = [];

  for (var l = 0; l < lines.length; l++) {
    var line = lines[l];
    if (!line.trim()) continue;

    var entry;
    try { entry = JSON.parse(line); } catch (e) { continue; }

    var fileId = entry.custom_id;
    var rowIdx = -1;
    for (var i = 1; i < kandidatData.length; i++) {
      if (kandidatData[i][fileIdCol] === fileId) { rowIdx = i; break; }
    }
    var nama = rowIdx >= 0 ? kandidatData[rowIdx][namaCol] : '?';
    var email = rowIdx >= 0 ? kandidatData[rowIdx][emailCol] : '';
    var subjek = rowIdx >= 0 ? kandidatData[rowIdx][subjekCol] : '';
    var tanggalMasuk = rowIdx >= 0 ? kandidatData[rowIdx][tanggalCol] : '';

    if (entry.result.type !== 'succeeded') {
      Logger.log('Gagal: ' + fileId);
      if (rowIdx >= 0) kandidatSheet.getRange(rowIdx + 1, statusCol + 1).setValue('Gagal');
      continue;
    }

    var textBlock = null;
    for (var c = 0; c < entry.result.message.content.length; c++) {
      if (entry.result.message.content[c].type === 'text') {
        textBlock = entry.result.message.content[c];
        break;
      }
    }

    var penilaian;
    try {
      var rawText = textBlock.text.trim();
      var cleaned = rawText.replace(/^```json\n?/gm, '').replace(/^```\n?/gm, '').trim();
      var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
      penilaian = JSON.parse(cleaned);
    } catch (e) {
      Logger.log('Gagal parse JSON untuk ' + fileId + '. Response: ' + textBlock.text.slice(0, 500));
      if (rowIdx >= 0) kandidatSheet.getRange(rowIdx + 1, statusCol + 1).setValue('Gagal Parse');
      continue;
    }

    // Format skill gap
    var sgArr = penilaian.skill_gap || [];
    var sgText = '';
    for (var s = 0; s < sgArr.length; s++) {
      sgText += '[' + sgArr[s].status + '] ' + sgArr[s].kriteria + ': ' + sgArr[s].catatan;
      if (s < sgArr.length - 1) sgText += '\n';
    }

    // Format pertanyaan interview
    var pqArr = penilaian.pertanyaan_interview || [];
    var pqText = '';
    for (var q = 0; q < pqArr.length; q++) {
      pqText += (q + 1) + '. ' + pqArr[q];
      if (q < pqArr.length - 1) pqText += '\n';
    }

    // Data untuk sheet Hasil Screening
    hasilBaru.push([
      nama, email, penilaian.skor_total, penilaian.kekuatan,
      penilaian.kekhawatiran, penilaian.rekomendasi,
      JSON.stringify(penilaian.skor_per_kriteria), sgText, pqText, fileId
    ]);

    // Data untuk sheet Analytics (Looker Studio)
    var dataCV = penilaian.data_cv || {};
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    analyticsBaru.push([
      today, nama, email, subjek,
      dataCV.kota_asal || '-',
      dataCV.tahun_pengalaman || 0,
      dataCV.pendidikan_terakhir || '-',
      dataCV.jurusan || '-',
      dataCV.skills || '-',
      penilaian.skor_total,
      penilaian.rekomendasi,
      fileId
    ]);

    if (rowIdx >= 0) kandidatSheet.getRange(rowIdx + 1, statusCol + 1).setValue('Selesai');
  }

  // Sort hasil by skor tertinggi
  hasilBaru.sort(function(a, b) { return b[2] - a[2]; });

  // Clear & tulis Hasil Screening
  if (hasilBaru.length > 0 && hasilSheet.getLastRow() > 1) {
    hasilSheet.getRange(2, 1, hasilSheet.getLastRow() - 1, hasilSheet.getLastColumn()).clearContent();
  }
  for (var h = 0; h < hasilBaru.length; h++) {
    hasilSheet.appendRow(hasilBaru[h]);
  }

  // Tulis Analytics Data (append, jangan clear — biar histori terakumulasi)
  for (var a = 0; a < analyticsBaru.length; a++) {
    analyticsSheet.appendRow(analyticsBaru[a]);
  }

  Logger.log(hasilBaru.length + ' hasil screening ditambahkan.');
  Logger.log(analyticsBaru.length + ' data analytics ditambahkan.');
  return true;
}

// ============================================================
// ===== 6. DASHBOARD ANALYTICS (CHART DI SHEETS) =====
// ============================================================

function generateDashboard() {
  var config = getConfig();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Dashboard Ringkasan ---
  var dashSheet = getOrCreateSheet('Dashboard', [
    'METRIK', 'NILAI'
  ]);

  // Hapus data lama (keep header)
  if (dashSheet.getLastRow() > 1) {
    dashSheet.getRange(2, 1, dashSheet.getLastRow() - 1, dashSheet.getLastColumn()).clearContent();
  }

  // Ambil data analytics
  var analyticsSheet = getOrCreateSheet(config.SHEET_ANALYTICS, [
    'Tanggal Screening', 'Nama Kandidat', 'Email', 'Subjek Lamaran',
    'Kota Asal', 'Tahun Pengalaman', 'Pendidikan Terakhir', 'Jurusan',
    'Skills', 'Skor Total', 'Rekomendasi', 'Drive File ID'
  ]);
  var data = analyticsSheet.getDataRange().getValues();

  if (data.length <= 1) {
    Logger.log('Belum ada data analytics. Jalankan checkBatchStatus dulu.');
    return;
  }

  // Hitung metrik
  var totalKandidat = data.length - 1;
  var skorTotal = 0;
  var skorMin = 999;
  var skorMax = 0;
  var rekomendasiCount = {};
  var kotaCount = {};
  var pendidikanCount = {};
  var skillsCount = {};

  for (var i = 1; i < data.length; i++) {
    var skor = parseFloat(data[i][9]) || 0;
    var rekomendasi = data[i][10] || '-';
    var kota = data[i][4] || '-';
    var pendidikan = data[i][6] || '-';
    var skillsStr = data[i][8] || '-';

    skorTotal += skor;
    if (skor < skorMin) skorMin = skor;
    if (skor > skorMax) skorMax = skor;

    rekomendasiCount[rekomendasi] = (rekomendasiCount[rekomendasi] || 0) + 1;
    kotaCount[kota] = (kotaCount[kota] || 0) + 1;
    pendidikanCount[pendidikan] = (pendidikanCount[pendidikan] || 0) + 1;

    // Parse skills (comma separated)
    if (skillsStr && skillsStr !== '-') {
      var skills = skillsStr.split(',');
      for (var s = 0; s < skills.length; s++) {
        var skill = skills[s].trim();
        if (skill) skillsCount[skill] = (skillsCount[skill] || 0) + 1;
      }
    }
  }

  var skorRataRata = (skorTotal / totalKandidat).toFixed(1);

  // Tulis metrik ke Dashboard
  var metrics = [
    ['Total Kandidat', totalKandidat],
    ['Skor Rata-rata', skorRataRata],
    ['Skor Tertinggi', skorMax],
    ['Skor Terendah', skorMin],
    ['', ''],
    ['--- REKOMENDASI ---', ''],
    ['Lanjut ke Interview', rekomendasiCount['Lanjut ke interview'] || 0],
    ['Pertimbangkan', rekomendasiCount['Pertimbangkan'] || 0],
    ['Tidak Sesuai', rekomendasiCount['Tidak sesuai'] || 0],
    ['', ''],
    ['--- TOP 5 KOTA ASAL ---', '']
  ];

  // Sort kota by count
  var kotaSorted = Object.keys(kotaCount).sort(function(a, b) {
    return kotaCount[b] - kotaCount[a];
  });
  for (var k = 0; k < Math.min(5, kotaSorted.length); k++) {
    metrics.push([kotaSorted[k], kotaCount[kotaSorted[k]]]);
  }

  metrics.push(['', '']);
  metrics.push(['--- TOP 5 PENDIDIKAN ---', '']);

  var pendSorted = Object.keys(pendidikanCount).sort(function(a, b) {
    return pendidikanCount[b] - pendidikanCount[a];
  });
  for (var p = 0; p < Math.min(5, pendSorted.length); p++) {
    metrics.push([pendSorted[p], pendidikanCount[pendSorted[p]]]);
  }

  metrics.push(['', '']);
  metrics.push(['--- TOP 10 SKILLS ---', '']);

  var skillsSorted = Object.keys(skillsCount).sort(function(a, b) {
    return skillsCount[b] - skillsCount[a];
  });
  for (var sk = 0; sk < Math.min(10, skillsSorted.length); sk++) {
    metrics.push([skillsSorted[sk], skillsCount[skillsSorted[sk]]]);
  }

  for (var m = 0; m < metrics.length; m++) {
    dashSheet.appendRow(metrics[m]);
  }

  // Format Dashboard
  dashSheet.setColumnWidth(1, 250);
  dashSheet.setColumnWidth(2, 150);

  Logger.log('Dashboard berhasil digenerate! Buka sheet "Dashboard" untuk lihat.');
  Logger.log('Total kandidat: ' + totalKandidat + ', Skor rata-rata: ' + skorRataRata);
}

// ============================================================
// ===== 7. NOTIFIKASI TELEGRAM =====
// ============================================================

function sendTelegramMessage(text) {
  var config = getConfig();
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) return;
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + config.TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: config.TELEGRAM_CHAT_ID, text: text }),
      muteHttpExceptions: true
    });
  } catch (e) {}
}

// ============================================================
// ===== SETUP & TESTING =====
// ============================================================

function setupTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  ScriptApp.newTrigger('runIntakeAndSubmit')
    .timeBased().everyDays(1).atHour(7).create();

  ScriptApp.newTrigger('checkBatchStatus')
    .timeBased().everyMinutes(30).create();

  Logger.log('Trigger terpasang.');
}

function runIntakeAndSubmit() {
  intakeFromGmail();
  buildAndSubmitBatch();
}

function testSetup() {
  var config = getConfig();
  Logger.log('=== CEK SETUP ===');

  Logger.log('1. CLAUDE_API_KEY: ' + (!!config.CLAUDE_API_KEY ? 'ADA' : 'BELUM'));

  var label = GmailApp.getUserLabelByName(config.GMAIL_LABEL_MASUK);
  Logger.log('2. Label "' + config.GMAIL_LABEL_MASUK + '": ' + (label ? 'ADA' : 'BELUM'));

  var driveApiOk = false;
  try { Drive.Files; driveApiOk = true; } catch (e) {}
  Logger.log('3. Drive API: ' + (driveApiOk ? 'AKTIF' : 'BELUM'));

  var criteria = getCriteriaText();
  Logger.log('4. Kriteria: ' + (criteria ? 'ADA' : 'BELUM'));

  var running = PropertiesService.getScriptProperties().getProperty('CURRENT_BATCH_ID');
  Logger.log('5. Batch berjalan: ' + (running || 'TIDAK'));

  var analyticsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.SHEET_ANALYTICS);
  var totalAnalytics = analyticsSheet ? (analyticsSheet.getLastRow() - 1) : 0;
  Logger.log('6. Data analytics: ' + totalAnalytics + ' record');

  Logger.log('=== SELESAI ===');
}
