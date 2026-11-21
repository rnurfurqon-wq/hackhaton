"""Data contoh fiktif untuk tombol "Coba dengan contoh" dan mode demo."""

SAMPLE_CV = """DIMAS PRATAMA
Mahasiswa S1 Data Science, Universitas Cakrawala (2026 - sekarang)
Jakarta Selatan | dimas.pratama@email.com

RINGKASAN
Mahasiswa Data Science semester 1 yang tertarik pada analisis data dan otomasi laporan.

PENGALAMAN ORGANISASI
Bendahara Himpunan Mahasiswa Data Science (2026 - sekarang)
- Menyusun query SQL untuk rekap keuangan himpunan setiap bulan
- Membuat dashboard keuangan himpunan di Google Sheets yang dipakai pengurus inti
- Mempresentasikan laporan keuangan di rapat pleno himpunan

Staf Acara, Cross The World Gathering (2026)
- Menyusun rundown dan mengoordinasikan 6 pengisi acara

PROYEK
Pembersihan Data Survei Kepuasan Mahasiswa
- Membuat skrip Python untuk membersihkan data survei dari 400 responden

KETERAMPILAN
SQL, Python (pandas), Excel dan Google Sheets, presentasi
"""

SAMPLE_JOBS = {
    "cocok": {
        "label": "Data Analyst Intern (cocok)",
        "selection_type": "kerja",
        "text": """Data Analyst Intern - PT Contoh Analitika Nusantara (Jakarta, hybrid, 6 bulan)

Tanggung jawab:
- Menyiapkan laporan mingguan performa penjualan
- Membersihkan dan menggabungkan data dari beberapa sumber
- Membuat dashboard di Tableau atau Looker Studio
- Menyampaikan temuan analisis kepada tim bisnis

Kualifikasi:
- Mahasiswa aktif jurusan Data Science, Statistika, atau sejenis
- Menguasai SQL (wajib)
- Menguasai Python untuk pengolahan data (wajib)
- Terbiasa dengan Tableau atau Looker Studio (wajib)
- Memahami statistik dasar (nilai plus)
- Mampu mengomunikasikan hasil analisis dengan jelas
""",
    },
    "tidak_cocok": {
        "label": "Backend Engineer Golang (tidak cocok)",
        "selection_type": "kerja",
        "text": """Backend Engineer (Golang) - PT Contoh Teknologi Finansial

Kualifikasi:
- Minimal 3 tahun pengalaman sebagai backend engineer
- Mahir Golang dan desain REST API
- Berpengalaman dengan PostgreSQL, Redis, dan message queue (Kafka)
- Memahami arsitektur microservices dan Kubernetes
- Nilai plus: pengalaman di industri pembayaran digital
""",
    },
    "kepanitiaan": {
        "label": "Open Recruitment Divisi Acara (kepanitiaan)",
        "selection_type": "kepanitiaan",
        "text": """Open Recruitment Panitia CAKREN - Divisi Acara

Tugas divisi:
- Menyusun konsep dan rundown acara utama
- Berkoordinasi dengan pembicara dan pengisi acara
- Menangani perubahan mendadak saat hari pelaksanaan

Yang kami cari:
- Mahasiswa aktif Universitas Cakrawala
- Pengalaman kepanitiaan acara (nilai plus)
- Mampu bekerja dalam tim dan di bawah tekanan
- Bersedia hadir rapat mingguan dan pada hari pelaksanaan
- Komunikatif dan teliti
""",
    },
}
