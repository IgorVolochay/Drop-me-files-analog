// Utility function to format bytes to human-readable format
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Check if we're on the download page
const path = window.location.pathname;
const downloadMatch = path.match(/^\/get\/([a-zA-Z0-9]{6})$/);

if (downloadMatch) {
  // Show download page
  document.getElementById('uploadPage').style.display = 'none';
  document.getElementById('downloadPage').style.display = 'block';
  
  const fileUuid = downloadMatch[1];
  handleDownloadPage(fileUuid);
} else {
  // Show upload page
  document.getElementById('uploadPage').style.display = 'block';
  document.getElementById('downloadPage').style.display = 'none';
  initUploadPage();
}

// Download page handler
async function handleDownloadPage(fileUuid) {
  const downloadStatus = document.getElementById('downloadStatus');
  const downloadContent = document.getElementById('downloadContent');
  
  try {
    const response = await fetch(`/api/get_download_link/${fileUuid}`);
    const data = await response.json();
    
    if (data.error || !data.result || !data.result.data) {
      downloadStatus.textContent = data.result?.comment || 'Ошибка при получении файла';
      downloadStatus.className = 'status error';
      return;
    }
    
    const fileData = data.result.data;
    downloadContent.innerHTML = `
      <div class="file-info">
        <h2>${fileData.file_name}</h2>
        <p class="file-size">Размер: ${formatBytes(parseInt(fileData.file_size))}</p>
        <a href="${fileData.url}" download="${fileData.file_name}" class="download-button">
          Скачать файл
        </a>
      </div>
    `;
    downloadStatus.style.display = 'none';
  } catch (error) {
    downloadStatus.textContent = `Ошибка: ${error.message}`;
    downloadStatus.className = 'status error';
  }
}

// Upload page initialization
function initUploadPage() {
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const uploadButton = document.getElementById('uploadButton');
  const uploadForm = document.getElementById('uploadForm');
  const statusDiv = document.getElementById('status');
  const maxFileSizeSpan = document.getElementById('maxFileSize');
  
  let maxFileSizeBytes = 0;
  
  // Fetch max file size on page load
  async function loadMaxFileSize() {
    try {
      const response = await fetch('/api/max_file_size');
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      maxFileSizeBytes = await response.json();
      maxFileSizeSpan.textContent = formatBytes(maxFileSizeBytes);
      
      // Set max file size attribute
      fileInput.setAttribute('data-max-size', maxFileSizeBytes);
    } catch (error) {
      maxFileSizeSpan.textContent = 'ошибка загрузки';
      maxFileSizeSpan.style.color = '#dc2626';
      console.error('Error loading max file size:', error);
    }
  }
  
  loadMaxFileSize();
  
  const updateButtonState = () => {
    if (!fileInput.files || fileInput.files.length === 0) {
      uploadButton.disabled = true;
      return;
    }
    
    const file = fileInput.files[0];
    if (file.size > maxFileSizeBytes && maxFileSizeBytes > 0) {
      setStatus(`Файл слишком большой. Максимальный размер: ${formatBytes(maxFileSizeBytes)}`, 'error');
      uploadButton.disabled = true;
      return;
    }
    
    uploadButton.disabled = false;
    setStatus('', '');
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
      // Only take the first file
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(event.dataTransfer.files[0]);
      fileInput.files = dataTransfer.files;
      updateButtonState();
    }
  });
  
  fileInput.addEventListener('change', () => {
    updateButtonState();
  });
  
  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    if (!fileInput.files || fileInput.files.length === 0) {
      setStatus('Выберите файл для загрузки.', 'error');
      return;
    }
    
    const file = fileInput.files[0];
    
    if (maxFileSizeBytes > 0 && file.size > maxFileSizeBytes) {
      setStatus(`Файл слишком большой. Максимальный размер: ${formatBytes(maxFileSizeBytes)}`, 'error');
      return;
    }
    
    uploadButton.disabled = true;
    dropzone.classList.remove('dragover');
    setStatus('Получение токена загрузки...', '');
    
    try {
      // Step 1: Get upload token
      const tokenUrl = `/api/upload_token?file_name=${encodeURIComponent(file.name)}&file_type=${encodeURIComponent(file.type)}&file_size=${file.size}`;
      const tokenResponse = await fetch(tokenUrl);
      
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        throw new Error(errorData.result?.comment || `Ошибка сервера: ${tokenResponse.status}`);
      }
      
      const tokenData = await tokenResponse.json();
      
      if (tokenData.error || !tokenData.result || !tokenData.result.data) {
        throw new Error(tokenData.result?.comment || 'Ошибка при получении токена загрузки');
      }
      
      const uploadData = tokenData.result.data;
      const fileUuid = tokenData.result.file_uuid;
      uploadData.fields["key"] = fileUuid;
      delete uploadData.fields["Content-Type"];
      
      setStatus('Загрузка файла на сервер...', '');
      
      // Step 2: Upload to S3 using form-data
      // Add all fields from the API response (order matters for S3, file should be last)
      const formData = new FormData();
      Object.keys(uploadData.fields).forEach(key => {
        formData.append(key, uploadData.fields[key]);
      });
      // File must be appended last
      formData.append('file', file);
      
      const uploadResponse = await fetch(uploadData.url, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Ошибка загрузки на S3: ${uploadResponse.status}`);
      }
      
      // Success!
      const downloadUrl = `${window.location.origin}/get/${fileUuid}`;
      setStatus(`Файл успешно загружен! UUID: ${fileUuid}. Ссылка для скачивания: ${downloadUrl}`, 'success');
      fileInput.value = '';
      updateButtonState();
      
    } catch (error) {
      setStatus(`Не удалось загрузить файл: ${error.message}`, 'error');
    } finally {
      uploadButton.disabled = false;
    }
  });
  
  updateButtonState();
}
