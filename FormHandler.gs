/**
 * ============================================================
 * FORM HANDLER — Landing Page Lamaran PT Angin Senyap
 * ============================================================
 *
 * Backend untuk menerima form lamaran dari landing page.
 * Simpan di Google Sheets & Google Drive, lalu trigger screening.
 *
 * CARA PAKAI:
 * 1. Buka Google Sheet yang sama dengan Code.gs
 * 2. Tambah file baru: FormHandler.gs
 * 3. Paste kode ini
 * 4. Deploy sebagai Web App:
 *    - Deploy → New Deployment
 *    - Type: Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 *    - Klik Deploy → Copy URL
 * 5. Paste URL ke lamaran.html → variabel FORM_SUBMIT_URL
 */

// ===== HANDLER UTAMA =====
function doPost(e) {
  try {
    var formData = e.parameter;
    var fileBlob = e.parameter.cv;

    // Validasi input wajib
    var nama = formData.nama || '';
    var email = formData.email || '';
    var telepon = formData.telepon || '';
    var posisi = formData.posisi || '';
    var coverLetter = formData.cover_letter || '';

    if (!nama || !email || !posisi) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Nama, email, dan posisi wajib diisi.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Setup config
    var config = getConfig();
    var folder = getOrCreateDriveFolder(config.DRIVE_FOLDER_NAME);

    // Simpan CV ke Drive
    var cvFileId = '';
    var cvFileName = '';
    if (fileBlob && fileBlob.getBytes) {
      var file = folder.createFile(fileBlob);
      cvFileName = file.getName();
      cvFileId = file.getId();
    }

    // Catat ke Sheet "Lamaran Masuk"
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    var sheet = getOrCreateSheet('Lamaran Masuk', [
      'Tanggal', 'Nama', 'Email', 'Telepon', 'Posisi',
      'Cover Letter', 'Nama File CV', 'Drive File ID', 'Status'
    ]);

    sheet.appendRow([today, nama, email, telepon, posisi, coverLetter, cvFileName, cvFileId, 'Baru']);

    // Auto-apply label Gmail (opsional — jika ingin trigger screening otomatis)
    try {
      var labelMasuk = GmailApp.getUserLabelByName(config.GMAIL_LABEL_MASUK);
      if (labelMasuk) {
        // Kirim email notifikasi ke diri sendiri
        var myEmail = Session.getActiveUser().getEmail();
        var subject = '📄 Lamaran Baru: ' + nama + ' — ' + posisi;
        var body = 'Lamaran baru diterima dari form landing page:\n\n'
          + 'Nama: ' + nama + '\n'
          + 'Email: ' + email + '\n'
          + 'Telepon: ' + telepon + '\n'
          + 'Posisi: ' + posisi + '\n'
          + 'Cover Letter: ' + coverLetter + '\n'
          + 'CV: ' + cvFileName + '\n\n'
          + 'Buka Google Sheet untuk detail: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl();

        GmailApp.sendEmail(myEmail, subject, body);
      }
    } catch (emailErr) {
      Logger.log('Email notifikasi gagal: ' + emailErr.message);
    }

    Logger.log('Lamaran diterima: ' + nama + ' (' + email + ') — ' + posisi);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Lamaran berhasil dikirim.',
      data: {
        nama: nama,
        posisi: posisi,
        tanggal: today
      }
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('Error doPost: ' + err.message);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Terjadi kesalahan server: ' + err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== HANDLER GET (untuk test) =====
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'PT Angin Senyap — Form Handler aktif.',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
