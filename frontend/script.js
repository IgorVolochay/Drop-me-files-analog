const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const uploadButton = document.getElementById('uploadButton');
const uploadForm = document.getElementById('uploadForm');
const statusDiv = document.getElementById('status');

const updateButtonState = () => {
  uploadButton.disabled = !fileInput.files || fileInput.files.length === 0;
};

const setStatus = (message, type = '') => {
  statusDiv.textContent = message;
  statusDiv.className = type ? `status ${type}` : 'status';
};

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('dragover');

  if (event.dataTransfer?.files?.length) {
    fileInput.files = event.dataTransfer.files;
    updateButtonState();
  }
});

fileInput.addEventListener('change', () => {
  updateButtonState();
});

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!fileInput.files || fileInput.files.length === 0) {
    setStatus('Выберите файлов для загрузки.', 'error');
    return;
  }

  const formData = new FormData();
  Array.from(fileInput.files).forEach((file) => {
    formData.append('files', file);
  });

  uploadButton.disabled = true;
  dropzone.classList.remove('dragover');
  setStatus('Загрузка...', '');

  try {
    const response = await fetch('http://192.168.0.132:5000/upload_file', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }

    const data = await response.text();
    setStatus(`Путь к файлу: ${data}`, 'success');
    fileInput.value = '';
  } catch (error) {
    setStatus(`Не удалось загрузить файлы: ${error.message}`, 'error');
  } finally {
    uploadButton.disabled = false;
  }
});

updateButtonState();

