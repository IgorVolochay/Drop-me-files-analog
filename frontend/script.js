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
// Match /get/ followed by any alphanumeric characters (not just exactly 6)
const downloadMatch = path.match(/^\/get\/([a-zA-Z0-9]+)$/);

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
  
  // Check UUID length first (must be exactly 6 characters)
  if (fileUuid.length !== 6) {
    downloadStatus.textContent = 'Мы не смогли ничего найти.\nПерепроверьте введенный адрес.';
    downloadStatus.className = 'status error';
    downloadStatus.style.display = 'block';
    downloadContent.innerHTML = '';
    return;
  }
  
  // Show loading state
  downloadStatus.textContent = 'Загрузка...';
  downloadStatus.className = 'status';
  downloadStatus.style.display = 'block';
  downloadContent.innerHTML = '';
  
  try {
    const response = await fetch(`/api/get_download_link/${fileUuid}`);
    
    // Check for network/connection errors
    if (!response.ok && (response.status === 0 || response.status >= 500)) {
      downloadStatus.textContent = 'Сервис временно недоступен,\nприносим наши извинения.';
      downloadStatus.className = 'status error';
      downloadStatus.style.display = 'block';
      downloadContent.innerHTML = '';
      return;
    }
    
    const data = await response.json();
    
    // Check for errors (400, 404, or error flag in response)
    if (data.error || !data.result || !data.result.data || response.status === 400 || response.status === 404) {
      downloadStatus.textContent = 'Мы не смогли ничего найти.\nПерепроверьте введенный адрес.';
      downloadStatus.className = 'status error';
      downloadStatus.style.display = 'block';
      downloadContent.innerHTML = '';
      return;
    }
    
    const fileData = data.result.data;
    const fileSize = parseInt(fileData.file_size);
    
    // Create download button handler with progress tracking
    const handleDownload = async () => {
      const downloadButton = document.getElementById('downloadButton');
      const downloadProgress = document.getElementById('downloadProgress');
      const progressBar = document.getElementById('progressBar');
      const progressText = document.getElementById('progressText');
      
      // For small files (< 10MB), use direct download (browser's native download)
      // For larger files, show progress bar
      if (fileSize < 10 * 1024 * 1024) {
        // Small file - use direct download with browser's native progress
        const link = document.createElement('a');
        link.href = fileData.url;
        link.download = fileData.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      
      // Large file - download with progress tracking
      try {
        downloadButton.disabled = true;
        downloadProgress.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        
        const response = await fetch(fileData.url);
        if (!response.ok) {
          throw new Error('Ошибка при загрузке файла');
        }
        
        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : fileSize;
        let loaded = 0;
        
        const reader = response.body.getReader();
        const chunks = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          loaded += value.length;
          
          const percent = Math.round((loaded / total) * 100);
          progressBar.style.width = percent + '%';
          progressText.textContent = `${percent}% (${formatBytes(loaded)} / ${formatBytes(total)})`;
        }
        
        // Combine chunks into blob
        const blob = new Blob(chunks);
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileData.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        window.URL.revokeObjectURL(blobUrl);
        downloadProgress.style.display = 'none';
        downloadButton.disabled = false;
        progressText.textContent = 'Загрузка завершена!';
        
        setTimeout(() => {
          progressText.textContent = '';
        }, 2000);
      } catch (error) {
        downloadProgress.style.display = 'none';
        downloadButton.disabled = false;
        // Fallback: try direct navigation
        window.location.href = fileData.url;
      }
    };
    
    downloadContent.innerHTML = `
      <div class="file-info">
        <h2>${fileData.file_name}</h2>
        <p class="file-size">Размер: ${formatBytes(parseInt(fileData.file_size))}</p>
        <button type="button" id="downloadButton" class="download-button">
          Загрузить
        </button>
      </div>
    `;
    
    // Attach click handler to the download button
    const downloadButton = document.getElementById('downloadButton');
    downloadButton.addEventListener('click', handleDownload);
    
    downloadStatus.style.display = 'none';
  } catch (error) {
    // Network error or other connection issues
    downloadStatus.textContent = 'Сервис временно недоступен,\nприносим наши извинения.';
    downloadStatus.className = 'status error';
    downloadStatus.style.display = 'block';
  }
}

// Show error popup
function showErrorPopup(message) {
  const popup = document.getElementById('errorPopup');
  popup.textContent = message;
  popup.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    popup.style.display = 'none';
  }, 5000);
}

// Upload page initialization
function initUploadPage() {
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const uploadButton = document.getElementById('uploadButton');
  const uploadForm = document.getElementById('uploadForm');
  const statusDiv = document.getElementById('status');
  const maxFileSizeSpan = document.getElementById('maxFileSize');
  const successContent = document.getElementById('successContent');
  const uploadFormContainer = uploadForm.parentElement;
  
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
      const errorMsg = `Файл слишком большой. Максимальный размер: ${formatBytes(maxFileSizeBytes)}`;
      showErrorPopup(errorMsg);
      uploadButton.disabled = true;
      return;
    }
    
    uploadButton.disabled = false;
    setStatus('', '');
  };
  
  const setStatus = (message, type = '') => {
    statusDiv.textContent = message;
    statusDiv.className = type ? `status ${type}` : 'status';
    // Hide status div when empty to avoid unnecessary spacing
    if (!message || message.trim() === '') {
      statusDiv.style.display = 'none';
    } else {
      statusDiv.style.display = 'block';
    }
  };
  
  const showSuccessState = (fileName, fileSize, downloadUrl) => {
    // Hide the form
    uploadForm.style.display = 'none';
    statusDiv.style.display = 'none';
    
    // Show success content
    document.getElementById('successFileName').textContent = fileName;
    document.getElementById('successFileSize').textContent = `Размер: ${formatBytes(fileSize)}`;
    document.getElementById('downloadLinkInput').value = downloadUrl;
    successContent.style.display = 'block';
    
    // Setup copy button
    const copyButton = document.getElementById('copyLinkButton');
    copyButton.onclick = () => {
      const input = document.getElementById('downloadLinkInput');
      input.select();
      input.setSelectionRange(0, 99999); // For mobile devices
      document.execCommand('copy');
      
      const originalText = copyButton.textContent;
      copyButton.textContent = 'Скопировано!';
      copyButton.classList.add('copied');
      
      setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.classList.remove('copied');
      }, 2000);
    };
    
    // Setup "upload another" button
    const uploadAnotherButton = document.getElementById('uploadAnotherButton');
    uploadAnotherButton.onclick = () => {
      // Reset form
      uploadForm.style.display = 'block';
      successContent.style.display = 'none';
      fileInput.value = '';
      updateButtonState();
    };
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
      showErrorPopup('Выберите файл для загрузки.');
      return;
    }
    
    const file = fileInput.files[0];
    
    if (maxFileSizeBytes > 0 && file.size > maxFileSizeBytes) {
      showErrorPopup(`Файл слишком большой. Максимальный размер: ${formatBytes(maxFileSizeBytes)}`);
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
        // Extract error message without status codes
        let errorMessage = errorData.result || 'Ошибка при загрузке файла';
        if (typeof errorMessage === 'object' && errorMessage.comment) {
          errorMessage = errorMessage.comment;
        }
        if (typeof errorMessage === 'string' && errorMessage.includes('too large')) {
          errorMessage = 'Файл слишком большой';
        }
        throw new Error(errorMessage);
      }
      
      const tokenData = await tokenResponse.json();
      
      if (tokenData.error || !tokenData.result || !tokenData.result.data) {
        let errorMessage = tokenData.result?.comment || 'Ошибка при получении токена загрузки';
        throw new Error(errorMessage);
      }
      
      const uploadData = tokenData.result.data;
      const fileUuid = tokenData.result.file_uuid;
      uploadData.fields["key"] = fileUuid;
      delete uploadData.fields["Content-Type"];
      
      // Hide status, show progress bar
      statusDiv.style.display = 'none';
      const uploadProgress = document.getElementById('uploadProgress');
      const uploadProgressBar = document.getElementById('uploadProgressBar');
      const uploadProgressText = document.getElementById('uploadProgressText');
      uploadProgress.style.display = 'block';
      uploadProgressBar.style.width = '0%';
      uploadProgressText.textContent = '0%';
      
      // Step 2: Upload to S3 using XMLHttpRequest for progress tracking
      await new Promise((resolve, reject) => {
        const formData = new FormData();
        Object.keys(uploadData.fields).forEach(key => {
          formData.append(key, uploadData.fields[key]);
        });
        // File must be appended last
        formData.append('file', file);
        
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            uploadProgressBar.style.width = percent + '%';
            uploadProgressText.textContent = `${percent}% (${formatBytes(event.loaded)} / ${formatBytes(event.total)})`;
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Ошибка загрузки: ${xhr.status}`));
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Ошибка при загрузке файла на сервер'));
        });
        
        xhr.addEventListener('abort', () => {
          reject(new Error('Загрузка прервана'));
        });
        
        xhr.open('POST', uploadData.url);
        xhr.send(formData);
      });
      
      // Hide progress bar after successful upload
      uploadProgress.style.display = 'none';
      
      // Success!
      const downloadUrl = `${window.location.origin}/get/${fileUuid}`;
      showSuccessState(file.name, file.size, downloadUrl);
      fileInput.value = '';
      
    } catch (error) {
      // Extract clean error message without status codes
      let errorMessage = error.message;
      if (errorMessage.includes('status') || errorMessage.match(/\d{3}/)) {
        if (errorMessage.includes('too large') || errorMessage.includes('413')) {
          errorMessage = 'Файл слишком большой';
        } else if (errorMessage.includes('500')) {
          errorMessage = 'Ошибка сервера. Попробуйте позже';
        } else {
          errorMessage = 'Не удалось загрузить файл';
        }
      }
      showErrorPopup(errorMessage);
      setStatus('', '');
      // Hide progress bar on error
      const uploadProgress = document.getElementById('uploadProgress');
      if (uploadProgress) {
        uploadProgress.style.display = 'none';
      }
    } finally {
      uploadButton.disabled = false;
    }
  });
  
  updateButtonState();
}
