
// --- DOM 元素引用 ---
const imgElement = document.getElementById("display-img");
const resolutionInfo = document.getElementById("resolution-info");
const filenameInfo = document.getElementById("filename-info");
const infoContainer = document.getElementById("info-container");
const descriptionTextElement = document.getElementById('description-text'); // 已在WASM模块中引用
const ipt = document.getElementById("ipt");
const btn_enc = document.getElementById("enc");
const btn_enc_all = document.getElementById("enc-all");
const btn_dec = document.getElementById("dec");
const btn_dec_all = document.getElementById("dec-all");
const btn_restore = document.getElementById("re");
const btn_restore_all = document.getElementById("restore-all");
const btn_download = document.getElementById("download");
const btn_download_all = document.getElementById("download-all");
const globalStatus = document.getElementById("global-status");
const processingTimeInfo = document.getElementById("processing-time-info"); // 新增用于显示处理时间
const navigationControls = document.getElementById("navigation-controls");
const btn_prev = document.getElementById("prev");
const btn_next = document.getElementById("next");
const imageCountInfo = document.getElementById("image-count-info");
const emptyState = document.getElementById('empty-state');
const loadingOverlay = document.getElementById('global-loading-overlay');
const clearButtonsContainer = document.getElementById('clear-buttons-container');
const btn_clear_current = document.getElementById('clear-current');
const btn_clear_all = document.getElementById('clear-all');

document.addEventListener('DOMContentLoaded', function() {
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsDropdown = document.getElementById('settings-dropdown');
    
    if (settingsToggle && settingsDropdown) {
        settingsToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            settingsDropdown.classList.toggle('show');
            if (settingsDropdown.classList.contains('show')) {
                settingsDropdown.classList.remove('hidden');
            } else {
                settingsDropdown.classList.add('hidden');
            }
        });
        
        document.addEventListener('click', function() { 
            if (settingsDropdown.classList.contains('show')) {
                settingsDropdown.classList.remove('show');
                settingsDropdown.classList.add('hidden');
            }
        });
        
        settingsDropdown.addEventListener('click', function(e) {
            const menuItem = e.target.closest('.menu-item');
            if (menuItem) {
                setTimeout(() => {
                    settingsDropdown.classList.remove('show');
                    settingsDropdown.classList.add('hidden');
                }, 0); 
            }
            if (!menuItem) {
                 e.stopPropagation(); 
            }
        });
    }
    updateButtonStates();
});

// --- 状态变量 ---
let imageStates = []; 
let currentFileIndex = -1; 
let isProcessingGlobal = false; 

// --- 状态类型到 CSS 类的映射 ---
const statusClassMap = {
    info: 'status-info', success: 'status-success', warning: 'status-warning', error: 'status-error',
};

// --- 辅助函数 ---
function revokeBlobUrl(url) { if (url && url.startsWith('blob:')) { URL.revokeObjectURL(url); } }
function showLoading(show) { loadingOverlay.classList.toggle('hidden', !show); }


//  showStatus 函数
function showStatus(message, type = 'info', durationMs = null, usedMode = null) {
    let fullMessage = message;
    if (usedMode) {
        fullMessage += ` (使用${usedMode})`;
    }
    if (durationMs !== null) {
        fullMessage += ` 耗时: ${durationMs} ms`; // 直接将耗时拼接到主消息
    }
    descriptionTextElement.textContent = fullMessage;

    Object.values(statusClassMap).forEach(cls => descriptionTextElement.classList.remove(cls));
    if (statusClassMap[type]) { descriptionTextElement.classList.add(statusClassMap[type]); }
    descriptionTextElement.classList.remove('status-base'); 
    descriptionTextElement.classList.add('status-base');

    // 由于时间已包含在主消息中，底部的 processingTimeInfo 不再需要独立更新，可以清空或移除
    if (processingTimeInfo) {
        processingTimeInfo.textContent = ""; 
    }
}


// --- 更新所有按钮的禁用状态和可见性 ---
function updateButtonStates() {
    const hasImages = imageStates.length > 0;
    const currentImageState = (hasImages && currentFileIndex >= 0 && currentFileIndex < imageStates.length) ? imageStates[currentFileIndex] : null;
    const canProcessCurrent = hasImages && currentImageState && currentImageState.currentBlobUrl && !currentImageState.isProcessing && !isProcessingGlobal;
    const canProcessAll = hasImages && !isProcessingGlobal;

    const buttonsToToggle = [
        { btn: btn_enc, condition: canProcessCurrent }, { btn: btn_dec, condition: canProcessCurrent },
        { btn: btn_restore, condition: canProcessCurrent }, { btn: btn_download, condition: canProcessCurrent },
        { btn: btn_enc_all, condition: canProcessAll }, { btn: btn_dec_all, condition: canProcessAll },
        { btn: btn_restore_all, condition: canProcessAll }, { btn: btn_download_all, condition: canProcessAll },
        { btn: btn_prev, condition: hasImages && imageStates.length > 1 && currentFileIndex > 0 && !isProcessingGlobal },
        { btn: btn_next, condition: hasImages && imageStates.length > 1 && currentFileIndex < imageStates.length - 1 && !isProcessingGlobal },
        { btn: document.getElementById('upload-btn'), condition: !isProcessingGlobal },
        { btn: btn_clear_current, condition: hasImages && !isProcessingGlobal },
        { btn: btn_clear_all, condition: hasImages && !isProcessingGlobal }
    ];

    buttonsToToggle.forEach(({ btn, condition }) => {
        if (btn) { btn.disabled = !condition; btn.classList.toggle('btn-disabled', !condition); }
    });

    if (hasImages && imageStates.length > 1) {
        navigationControls.style.display = "flex";
        imageCountInfo.textContent = `${currentFileIndex + 1}/${imageStates.length}`;
    } else {
        navigationControls.style.display = "none";
        imageCountInfo.textContent = ""; 
        globalStatus.textContent = "";
        if(processingTimeInfo) processingTimeInfo.textContent = ""; // 清除时间
    }
    
    infoContainer.style.display = hasImages ? "block" : "none";
    clearButtonsContainer.style.display = hasImages ? 'flex' : 'none';
    emptyState.style.display = hasImages ? 'none' : 'block';
}


// --- 设置并显示图片 ---
function setDisplayImage(state) {
    imgElement.style.display = "none";
    filenameInfo.textContent = "";
    resolutionInfo.textContent = "";

    if (!state || !state.currentBlobUrl) {
        if (imgElement.src && imgElement.src.startsWith('blob:')) { revokeBlobUrl(imgElement.src); }
        imgElement.src = "";
        emptyState.style.display = 'block';
        updateButtonStates();
        return;
    }

    emptyState.style.display = 'none';
    imgElement.src = state.currentBlobUrl;
    imgElement.dataset.currentFilename = state.currentFilename;

    imgElement.onload = () => {
        filenameInfo.textContent = state.currentFilename;
        resolutionInfo.textContent = `${imgElement.naturalWidth} x ${imgElement.naturalHeight}`;
        imgElement.style.display = "block";
        imgElement.style.opacity = 1;
        updateButtonStates();
    };
    imgElement.onerror = () => {
        console.error("图片加载错误:", state.currentFilename);
        filenameInfo.textContent = state.currentFilename;
        resolutionInfo.textContent = "无法加载";
        imgElement.style.display = "none";
        emptyState.style.display = 'block';
        updateButtonStates();
        showStatus(`图片 ${state.currentFilename} 加载失败!`, 'error');
    };
}




//  formatFileSize 函数：
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes < k) return bytes + ' ' + sizes[0]; // 避免 Math.log(bytes) 当 bytes<1 时出错
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


// --- 显示当前索引的图片 ---
function displayCurrentImage() {
    if (imageStates.length > 0 && currentFileIndex >= 0 && currentFileIndex < imageStates.length) {
        setDisplayImage(imageStates[currentFileIndex]);
    } else {
        setDisplayImage(null); 
    }
}


// --- 纯JS实现的像素操作 (用于回退) ---
function jsPixelManipulation(imgdataIn, imgdataOut, width, height, operationType) {
    const curve = gilbert2d(width, height); // gilbert2d 是全局的
    const totalPixels = width * height;
    if (curve.length !== totalPixels) {
        console.warn(`[JS 回退] 曲线点数 (${curve.length}) 与像素数 (${totalPixels}) 不匹配。 文件: ${imgdataIn.filename || '未知'}. 这可能导致处理不完整或错误。`);
    }
    const offset = Math.round((Math.sqrt(5) - 1) / 2 * totalPixels);

    for (let i = 0; i < totalPixels; i++) {
        // 确保索引在 curve 数组的有效范围内
        if (i >= curve.length || ((i + offset) % totalPixels) >= curve.length) {
            // console.warn(`[JS 回退] 索引越界跳过: i=${i}, curve.length=${curve.length}`);
            continue;
        }
        const old_pos_map = curve[i];
        const new_pos_map = curve[(i + offset) % totalPixels];
        
        // 增加对 old_pos_map 和 new_pos_map 的有效性检查
        if (!old_pos_map || !new_pos_map || 
            old_pos_map[0] < 0 || old_pos_map[0] >= width || old_pos_map[1] < 0 || old_pos_map[1] >= height || 
            new_pos_map[0] < 0 || new_pos_map[0] >= width || new_pos_map[1] < 0 || new_pos_map[1] >= height) {
            // console.warn(`[JS 回退] 坐标越界跳过: old=(${old_pos_map}), new=(${new_pos_map})`);
            continue;
        }

        const p_original = 4 * (old_pos_map[0] + old_pos_map[1] * width);
        const p_transformed = 4 * (new_pos_map[0] + new_pos_map[1] * width);

        // 增加对图像数据数组索引的检查
        if (p_original < 0 || p_original + 3 >= imgdataIn.data.length || 
            p_transformed < 0 || p_transformed + 3 >= imgdataOut.data.length) { // 注意imgdataOut.data.length
            // console.warn(`[JS 回退] 像素索引越界跳过: p_original=${p_original}, p_transformed=${p_transformed}, data_len=${imgdataIn.data.length}`);
            continue;
        }

        if (operationType === 'encrypt') {
            const pixelData = imgdataIn.data.slice(p_original, p_original + 4);
            imgdataOut.data.set(pixelData, p_transformed);
        } else { // decrypt
            const pixelData = imgdataIn.data.slice(p_transformed, p_transformed + 4);
            imgdataOut.data.set(pixelData, p_original);
        }
    }
}



async function processImageAtIndex(operationType, index, imageSourceElementOrBlobUrl) {
    const startTime = performance.now();
    if (index < 0 || index >= imageStates.length) {
        console.error(`processImageAtIndex: 无效索引 ${index}`);
        throw new Error(`无效索引: ${index}`);
    }
    const state = imageStates[index];
    if (!state || state.isProcessing) {
        console.warn(`processImageAtIndex: 状态无效或正在处理中，索引 ${index}`);
        return 0; 
    }
    if (!imageSourceElementOrBlobUrl && !state.currentBlobUrl) {
        console.error(`processImageAtIndex: 索引 ${index} (${state.currentFilename}) 缺少图像源。`);
        throw new Error(`索引 ${index} (${state.currentFilename}) 缺少图像源。`);
    }

    const isCurrentlyDisplayed = (index === currentFileIndex && imageSourceElementOrBlobUrl === imgElement);
    state.isProcessing = true;
    
    if (isCurrentlyDisplayed) {
        imgElement.style.opacity = 0.5;
        showLoading(true);
    }
    updateButtonStates();
    await new Promise(requestAnimationFrame);

    return new Promise(async (resolve, reject) => {
        let usedMode = "JS"; 
        let finalProcessedPixelData;
        let sourceImageElement; 
        let tempImageCreated = false;

        // ***** 保存处理前的 currentBlobUrl，用于后续可能的 revoke *****
        const previousCurrentBlobUrl = state.currentBlobUrl; 
        // **********************************************************

        try {
            if (typeof imageSourceElementOrBlobUrl === 'string' && imageSourceElementOrBlobUrl.startsWith('blob:')) {
                console.log(`[批量] 为索引 ${index} (${state.currentFilename}) 从 Blob URL (${imageSourceElementOrBlobUrl.slice(-10)}) 创建新 Image`);
                sourceImageElement = new Image();
                tempImageCreated = true; 
                await new Promise((imgResolve, imgReject) => {
                    sourceImageElement.onload = () => {
                        console.log(`[批量] 新 Image (${state.currentFilename}) 加载完成: ${sourceImageElement.naturalWidth}x${sourceImageElement.naturalHeight}`);
                        imgResolve();
                    };
                    sourceImageElement.onerror = (errEvent) => { 
                        const errorMsg = `后台图片 (${state.currentFilename}) 加载失败。`;
                        console.error(errorMsg, errEvent, "源URL:", imageSourceElementOrBlobUrl);
                        imgReject(new Error(errorMsg));
                    };
                    sourceImageElement.src = imageSourceElementOrBlobUrl;
                });
            } else if (imageSourceElementOrBlobUrl instanceof HTMLImageElement && 
                       imageSourceElementOrBlobUrl.complete && 
                       imageSourceElementOrBlobUrl.naturalWidth > 0) {
                sourceImageElement = imageSourceElementOrBlobUrl;
                console.log(`[单张] 使用已加载的主 Image 元素 (${state.currentFilename}): ${sourceImageElement.naturalWidth}x${sourceImageElement.naturalHeight}`);
            } else if (imageSourceElementOrBlobUrl instanceof HTMLImageElement) { 
                console.warn(`[单张] 传入的 Image 元素 (${state.currentFilename}) 需要等待加载或状态异常。 complete: ${imageSourceElementOrBlobUrl.complete}, naturalWidth: ${imageSourceElementOrBlobUrl.naturalWidth}`);
                sourceImageElement = imageSourceElementOrBlobUrl; 
                if (!sourceImageElement.complete || sourceImageElement.naturalWidth === 0) {
                    await new Promise((imgResolve, imgReject) => { 
                        const tempOnloadForProcess = () => {
                            console.log(`[单张] 等待的 Image 元素 (${state.currentFilename}) 现已加载完成。`);
                            cleanupProcessHandlers(); imgResolve();
                        };
                        const tempOnerrorForProcess = (errEvt) => {
                            const errorMsg = `等待的 Image 元素 (${state.currentFilename}) 加载失败。`;
                            console.error(errorMsg, errEvt);
                            cleanupProcessHandlers(); imgReject(new Error(errorMsg));
                        };
                        const cleanupProcessHandlers = () => {
                            sourceImageElement.removeEventListener('load', tempOnloadForProcess);
                            sourceImageElement.removeEventListener('error', tempOnerrorForProcess);
                        };
                        sourceImageElement.addEventListener('load', tempOnloadForProcess);
                        sourceImageElement.addEventListener('error', tempOnerrorForProcess);
                        if (sourceImageElement.complete && sourceImageElement.naturalWidth === 0) {
                            cleanupProcessHandlers();
                            imgReject(new Error(`图像 (${state.currentFilename}) 已加载但尺寸为0。`));
                        }
                        if (!sourceImageElement.src || (sourceImageElement.src !== state.currentBlobUrl && sourceImageElement === imgElement)) {
                           if (state.currentBlobUrl) {
                               console.log(`[processImageAtIndex] 强制为imgElement设置src: ${state.currentBlobUrl.slice(-10)}`);
                               if(sourceImageElement.src !== state.currentBlobUrl) sourceImageElement.src = state.currentBlobUrl; // 只有不同时才设置
                           } else {
                               cleanupProcessHandlers();
                               imgReject(new Error(`图像 (${state.currentFilename}) 无有效src。`));
                           }
                        }
                    });
                }
            } else {
                const errorMsg = `图像源无效: ${state.currentFilename}`;
                console.error(errorMsg, "源:", imageSourceElementOrBlobUrl);
                throw new Error(errorMsg);
            }

            const width = sourceImageElement.naturalWidth;
            const height = sourceImageElement.naturalHeight;
            if (width === 0 || height === 0) throw new Error(`图片尺寸无效 (${width}x${height}): ${state.currentFilename}`);

            const cvs = document.createElement("canvas");
            cvs.width = width;
            cvs.height = height;
            const ctx = cvs.getContext("2d", { willReadFrequently: true });
            if (!ctx) throw new Error("无法获取Canvas 2D上下文。");
            ctx.drawImage(sourceImageElement, 0, 0, width, height);

            let imgdata;
            try {
                imgdata = ctx.getImageData(0, 0, width, height);
                imgdata.filename = state.currentFilename;
            } catch (e) { 
                console.error(`获取ImageData失败 (${state.currentFilename}): ${e.message}`, e);
                throw new Error(`获取图像数据失败: ${e.message}`); 
            }

            // --- WASM/JS 处理逻辑 ---
            if (window.wasmReady && window.wasm_encrypt_global && window.wasm_decrypt_global) {
                try {
                    // ... (WASM 调用逻辑如前)
                    console.log(`[WASM] 尝试 ${operationType} 操作: ${state.currentFilename}`);
                    const inputPixelDataForWasm = imgdata.data;
                    let wasmResultArray;
                    if (operationType === 'encrypt') {
                        wasmResultArray = window.wasm_encrypt_global(inputPixelDataForWasm, width, height);
                    } else {
                        wasmResultArray = window.wasm_decrypt_global(inputPixelDataForWasm, width, height);
                    }
                    if (!wasmResultArray || typeof wasmResultArray.length === 'undefined') {
                        throw new Error("WASM函数没有返回有效的数组。");
                    }
                    finalProcessedPixelData = wasmResultArray;
                    usedMode = "WASM";
                    console.log(`[WASM] ${operationType} 完成: ${state.currentFilename}`);
                } catch (wasmEx) {
                    // ... (WASM 失败，JS回退逻辑如前)
                    console.error(`[WASM] ${operationType} 执行失败 (${state.currentFilename}):`, wasmEx);
                    if (descriptionTextElement) { /* ...临时提示... */ }
                    console.log(`[JS回退] 由于WASM失败，使用纯JS ${operationType}: ${state.currentFilename}`);
                    const imgdata2_js_fallback = new ImageData(width, height);
                    jsPixelManipulation(imgdata, imgdata2_js_fallback, width, height, operationType);
                    finalProcessedPixelData = imgdata2_js_fallback.data;
                    usedMode = "JS (WASM执行失败后回退)";
                }
            } else {
                // ... (直接JS处理逻辑如前)
                console.log(`[JS] WASM未就绪，使用纯JS ${operationType}: ${state.currentFilename}`);
                const imgdata2_js = new ImageData(width, height);
                jsPixelManipulation(imgdata, imgdata2_js, width, height, operationType);
                finalProcessedPixelData = imgdata2_js.data;
                usedMode = "纯JS (WASM未加载)";
            }
            
            if (!finalProcessedPixelData || typeof finalProcessedPixelData.length === 'undefined') {
                throw new Error("处理后的像素数据无效。");
            }
            const finalImageData = new ImageData(new Uint8ClampedArray(finalProcessedPixelData), width, height);
            ctx.putImageData(finalImageData, 0, 0);
            // --- WASM/JS 处理逻辑结束 ---


            let baseName = state.originalFile.name;
            let newFilename;
            // ... (文件名生成逻辑如前) ...
            if (operationType === 'encrypt') { newFilename = baseName.startsWith("encrypted_") ? baseName : "encrypted_" + baseName; }
            else { newFilename = baseName.startsWith("encrypted_") ? baseName.substring("encrypted_".length) : "decrypted_" + baseName; if (!baseName.startsWith("encrypted_") && state.currentFilename !== state.originalFile.name) { newFilename = state.originalFile.name; } }
            if (!/\.jpe?g$/i.test(newFilename)) { newFilename = newFilename.replace(/\.[^.]+$/, '') + '.jpg'; }


            const newBlob = await new Promise((res, rej) => {
                cvs.toBlob(blob => {
                    if (blob) {
                        res(blob);
                    } else {
                        rej(new Error("Canvas toBlob 返回了 null，无法创建新图片。"));
                    }
                }, "image/jpeg", 0.95);
            });

            // ***** Blob URL 管理的关键部分 *****
            // 1. 释放处理前的 currentBlobUrl (它现在被保存在 previousCurrentBlobUrl)
            //    只有当它与 state.originalBlobUrl 不同时才释放，因为 originalBlobUrl 需要保留。
            //    或者，更准确地说，只有当 previousCurrentBlobUrl 不是原始的那个，才释放它。
            if (previousCurrentBlobUrl && 
                previousCurrentBlobUrl.startsWith('blob:') && 
                previousCurrentBlobUrl !== state.originalBlobUrl) { // 不释放原始的 Blob URL
                 console.log(`[Revoke] 释放处理前的 currentBlobUrl: ${previousCurrentBlobUrl.slice(-10)} (因为它不是 originalBlobUrl)`);
                 revokeBlobUrl(previousCurrentBlobUrl);
            } else if (previousCurrentBlobUrl === state.originalBlobUrl) {
                 console.log(`[No Revoke] 处理前的 currentBlobUrl (${previousCurrentBlobUrl.slice(-10)}) 是 originalBlobUrl，不释放。`);
            }
            // 2. 更新 state.currentBlobUrl 为新处理结果的 URL
            state.currentBlobUrl = URL.createObjectURL(newBlob);
            console.log(`[New Blob] state.currentBlobUrl 更新为: ${state.currentBlobUrl.slice(-10)}`);
            // ***********************************
            state.currentFilename = newFilename;
            
            const endTime = performance.now();
            const duration = parseFloat((endTime - startTime).toFixed(2));

            if (isCurrentlyDisplayed) {
                imgElement.style.opacity = 1;
                showLoading(false);
                setDisplayImage(state);
                showStatus(`${operationType === 'encrypt' ? '混淆' : '解混淆'}完成`, 'success', duration, usedMode);
            }
            
            resolve(duration);
        } catch (error) {
            const endTime = performance.now();
            const duration = parseFloat((endTime - startTime).toFixed(2));
            console.error(`处理图片索引 ${index} (${state?.currentFilename}) 失败 (模式: ${usedMode}), 耗时 ${duration}ms:`, error);
            
            if (isCurrentlyDisplayed) {
                imgElement.style.opacity = 1;
                showLoading(false);
                showStatus(`${operationType === 'encrypt' ? '混淆' : '解混淆'}失败: ${error.message}`, 'error', duration, usedMode);
                
                // 如果处理失败，currentBlobUrl 应该恢复到处理前的状态，即 previousCurrentBlobUrl
                // 而不应该是 originalBlobUrl，除非 previousCurrentBlobUrl 本身就是 originalBlobUrl
                if (state.currentBlobUrl !== previousCurrentBlobUrl && state.currentBlobUrl && state.currentBlobUrl.startsWith('blob:')) {
                    // 如果 state.currentBlobUrl 被意外更新了（比如中途创建了指向失败结果的 blob url）
                    // 先释放这个意外的 currentBlobUrl
                    revokeBlobUrl(state.currentBlobUrl);
                }
                state.currentBlobUrl = previousCurrentBlobUrl; // 恢复到处理前的 URL
                // filename 也应该恢复（如果之前被修改了的话，但通常是在成功后才改）
                // state.currentFilename (保持不变或尝试从 previousCurrentBlobUrl 对应的 state 恢复)

                setDisplayImage(state); 
            }
            reject(error);
        } finally {
            state.isProcessing = false;
            updateButtonStates();
        }
    });
}


// 3. handleSingleImageOperation 函数 (用于单张图片操作按钮)
// ==========================================================
function handleSingleImageOperation(operationType) {
    if (currentFileIndex < 0 || imageStates.length === 0) { 
        showStatus("请先选择图片", 'warning'); 
        return; 
    }
    if (isProcessingGlobal) {
        showStatus("全局操作进行中，请稍候...", 'info');
        return;
    }
    if (currentFileIndex >= 0 && currentFileIndex < imageStates.length) {
        const state = imageStates[currentFileIndex];
        if (state.isProcessing) {
            showStatus("当前图片已在处理中...", 'info');
            return;
        }

        // 确保主 img 元素已加载并显示的是当前 state 的 currentBlobUrl
        if (imgElement.src === state.currentBlobUrl && imgElement.complete && imgElement.naturalWidth > 0) {
            processImageAtIndex(operationType, currentFileIndex, imgElement)
                .catch(e => {
                    // 错误已在 processImageAtIndex 内部的 showStatus 中提示
                    console.error(`单张图片 ${operationType} 失败 (${state.currentFilename}):`, e);
                });
        } else {
            showStatus("当前图片未完全加载或状态异常，请稍候或尝试重新选择。", "warning");
            console.warn("主图像与当前状态的 currentBlobUrl 不匹配或未加载完成，无法进行单张操作。", 
                         `img.src: ${imgElement.src}, state.currentBlobUrl: ${state.currentBlobUrl}, img.complete: ${imgElement.complete}`);
            // 可以尝试强制重新加载 state.currentBlobUrl 到 imgElement
            if (state.currentBlobUrl) {
                console.log("尝试重新加载当前图片到主显示区...");
                setDisplayImage(state); // 这会设置 img.src 并触发 onload/onerror
                // 提示用户再次点击按钮
                showStatus("图片正在重新加载，请加载完成后再试。", "info");
            }
        }
    } else {
        console.error("handleSingleImageOperation: currentFileIndex 无效。");
        showStatus("内部错误：当前图片索引无效。", "error");
    }
}


// 4. processAllImages 函数 (用于批量处理)
// ==========================================
async function processAllImages(operationType) {
    if (isProcessingGlobal) {
        showStatus("已有全局操作进行中，请稍候。", "info");
        return;
    }
    if (imageStates.length === 0) { 
        showStatus("没有图片可处理", 'warning'); 
        return; 
    }

    const opText = operationType === 'encrypt' ? '混淆' : '解混淆';
    isProcessingGlobal = true; 
    showLoading(true); 
    updateButtonStates(); 
    globalStatus.textContent = `${opText}中... 0/${imageStates.length}`; 
    if(processingTimeInfo) processingTimeInfo.textContent = ""; // 清除之前的耗时

    console.log(`开始 ${opText} 全部图片 (${imageStates.length} 张)...`);
    let successCount = 0, errorCount = 0, totalDuration = 0;
    const operationStartTime = performance.now();
    let firstOpMode = null; 

    for (let i = 0; i < imageStates.length; i++) {
        globalStatus.textContent = `${opText}中... ${i + 1}/${imageStates.length}`; 
        const stateToProcess = imageStates[i];

        if (stateToProcess.isProcessing) { // 以防万一，虽然 isProcessingGlobal 应该阻止重入
            console.warn(`[批量] 跳过索引 ${i} (${stateToProcess.currentFilename}) 因为它已标记为正在处理。`);
            errorCount++; // 或者不计入错误，只是跳过
            continue;
        }

        if (stateToProcess && stateToProcess.currentBlobUrl) {
            try {
                // 传递 stateToProcess.currentBlobUrl 作为图像源
                const duration = await processImageAtIndex(operationType, i, stateToProcess.currentBlobUrl);
                if (firstOpMode === null) { // 记录第一次成功操作的模式
                     // processImageAtIndex 内部的 usedMode 才是准确的，但这里我们只能基于 wasmReady
                     // 但这不准确，因为WASM可能在单次调用中失败并回退
                     // 更好的方式是在 processImageAtIndex 返回 usedMode，但这会使 Promise 更复杂
                     // 暂时先这样，或者从 processImageAtIndex 的日志中观察
                    firstOpMode = window.wasmReady ? "WASM" : "纯JS"; 
                }
                totalDuration += duration;
                successCount++;
            } catch (e) {
                console.error(`[批量] 处理索引 ${i} (${stateToProcess.currentFilename}) 失败:`, e);
                errorCount++;
                if (firstOpMode === null) firstOpMode = "纯JS (或失败)";
            }
        } else {
            console.warn(`[批量] 跳过索引 ${i} (${stateToProcess?.currentFilename || '未知文件名'}) 因为缺少 currentBlobUrl 或状态无效。`);
            errorCount++;
        }
        // 短暂延迟，允许UI更新和其他事件处理 (可选)
        // await new Promise(r => setTimeout(r, 10)); 
    }

    const operationEndTime = performance.now();
    const totalOperationTime = parseFloat((operationEndTime - operationStartTime).toFixed(2));
    
    // 尝试从第一次成功处理的图片的状态中获取更准确的 usedMode
    // 这依然不完美，因为批量中途WASM可能坏掉
    let finalModeTextDetail = "";
    if (successCount > 0 && firstOpMode) {
         finalModeTextDetail = `(主要使用${firstOpMode})`;
    } else if (errorCount === imageStates.length) {
        finalModeTextDetail = "(全部失败)";
    }


    globalStatus.textContent = ""; 
    showLoading(false); 
    isProcessingGlobal = false; 
    updateButtonStates(); 

    console.log(`${opText} 全部完成: ${successCount} 成功, ${errorCount} 失败. 总耗时: ${totalOperationTime} ms (累积处理耗时: ${totalDuration.toFixed(2)} ms)`);
    
    const resultType = errorCount > 0 ? (successCount > 0 ? 'warning' : 'error') : 'success';
    let resultMsg;
    if (successCount === imageStates.length) {
        resultMsg = `${opText}全部完成`;
    } else if (successCount > 0) {
        resultMsg = `${opText}部分完成 (${successCount}/${imageStates.length})`;
    } else {
        resultMsg = `${opText}全部失败`;
    }
    
    showStatus(`${resultMsg} ${finalModeTextDetail}`, resultType, totalOperationTime);
    
    // 批量处理完成后，确保当前显示的图片 (如果列表不为空) 是最新的状态
    if (imageStates.length > 0 && currentFileIndex >= 0 && currentFileIndex < imageStates.length) {
        displayCurrentImage(); 
    } else if (imageStates.length === 0) {
        displayCurrentImage(); // 会显示空状态
    }
}


//全部还原
async function restoreAllImages() {
    if (isProcessingGlobal) {
        showStatus("已有全局操作进行中，请稍候。", "info");
        return;
    }
    if (imageStates.length === 0) { 
        showStatus("没有图片可还原", 'warning'); 
        return; 
    }

    isProcessingGlobal = true; 
    showLoading(true); 
    updateButtonStates(); 
    globalStatus.textContent = "全部还原中... 0/" + imageStates.length;
    if(processingTimeInfo) processingTimeInfo.textContent = "";

    console.log(`开始全部还原 (${imageStates.length} 张)...`);
    let restoredCount = 0;
    const operationStartTime = performance.now();

    for (let i = 0; i < imageStates.length; i++) {
        globalStatus.textContent = `全部还原中... ${i + 1}/${imageStates.length}`;
        const state = imageStates[i];

        if (state.isProcessing) { // 跳过正在被其他操作处理的图片
            console.warn(`[全部还原] 跳过索引 ${i} (${state.currentFilename}) 因为它已标记为正在处理。`);
            continue;
        }

        // 检查 state.originalBlobUrl 是否有效
        if (!state.originalBlobUrl || !state.originalBlobUrl.startsWith('blob:')) {
            console.error(`[全部还原] 索引 ${i} (${state.currentFilename}) 的 originalBlobUrl 无效或缺失。无法还原。`);
            // 这里可以决定是跳过还是尝试从 originalFile 重新创建，但根据我们的策略，它应该存在。
            // 如果它缺失，说明之前的逻辑有问题。
            // 为了安全，我们尝试从 originalFile 重新创建一次，但这不应该是常态。
            if (state.originalFile) {
                console.warn(`[全部还原] 尝试为索引 ${i} 从 originalFile 重新创建 originalBlobUrl。`);
                state.originalBlobUrl = URL.createObjectURL(state.originalFile);
                 if (!state.originalBlobUrl) { // 再次检查
                    console.error(`[全部还原] 索引 ${i} 重新创建 originalBlobUrl 失败。`);
                    continue; // 跳过这个文件
                 }
            } else {
                console.error(`[全部还原] 索引 ${i} 缺少 originalFile，无法创建 originalBlobUrl。`);
                continue; // 跳过
            }
        }
        
        // 只有当 currentBlobUrl 与 originalBlobUrl 不同时才需要操作
        if (state.currentBlobUrl !== state.originalBlobUrl) {
            // 释放当前指向“处理后”图片的 Blob URL
            if (state.currentBlobUrl && state.currentBlobUrl.startsWith('blob:')) {
                console.log(`[全部还原] Revoking currentBlobUrl: ${state.currentBlobUrl.slice(-10)} for index ${i}`);
                revokeBlobUrl(state.currentBlobUrl);
            }
            // 将 currentBlobUrl 指回缓存的 originalBlobUrl
            state.currentBlobUrl = state.originalBlobUrl;
            state.currentFilename = state.originalFile.name;
            restoredCount++;
            console.log(`[全部还原] Index ${i} (${state.currentFilename}) restored to originalBlobUrl: ${state.originalBlobUrl.slice(-10)}`);
        } else {
            console.log(`[全部还原] Index ${i} (${state.currentFilename}) 已是原始状态。`);
        }
        // await new Promise(r => setTimeout(r, 5)); // 可选的UI更新延迟
    }

    const operationEndTime = performance.now();
    const totalOperationTime = parseFloat((operationEndTime - operationStartTime).toFixed(2));

    globalStatus.textContent = ""; 
    showLoading(false); 
    isProcessingGlobal = false; 
    updateButtonStates();

    console.log(`全部还原完成: ${restoredCount} 张被有效还原, 总耗时: ${totalOperationTime} ms`);
    showStatus(`全部还原完成 (${restoredCount}/${imageStates.length}张)`, 'success', totalOperationTime);
    
    // 批量处理完成后，确保当前显示的图片 (如果列表不为空) 是最新的状态
    if (imageStates.length > 0 && currentFileIndex >= 0 && currentFileIndex < imageStates.length) {
        displayCurrentImage(); 
    } else if (imageStates.length === 0) {
        displayCurrentImage(); // 会显示空状态
    }
}


// 在全局定义日期格式化函数
function formatDateTime(date) {
    const pad = num => num.toString().padStart(2, '0');
    return [
        date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate()),
        '_', pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())
    ].join('');
}

 
 //使用zip打包方式
async function downloadAllImages() {
    if (imageStates.length === 0) {
        showStatus("没有图片可下载", 'warning');
        return;
    }
    
    isProcessingGlobal = true; showLoading(true); updateButtonStates();
    showStatus("正在准备下载包...", 'info');
    const operationStartTime = performance.now();
    
    try {
        const zip = new JSZip();
        const imgFolder = zip.folder("images");
        
        for (let i = 0; i < imageStates.length; i++) {
            const state = imageStates[i];
            if (state && state.currentBlobUrl) {
                const response = await fetch(state.currentBlobUrl);
                const blob = await response.blob();
                imgFolder.file(state.currentFilename || `image_${i + 1}.jpg`, blob);
                globalStatus.textContent = `准备中 ${i + 1}/${imageStates.length}`;
            }
        }
        
        const content = await zip.generateAsync({ type: "blob" }, (metadata) => {
            globalStatus.textContent = `压缩中 ${metadata.percent.toFixed(0)}%`;
        });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `images_${formatDateTime(new Date())}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        revokeBlobUrl(link.href); // 释放 ZIP 文件的 Blob URL

        const operationEndTime = performance.now();
        const totalOperationTime = parseFloat((operationEndTime - operationStartTime).toFixed(2));
        showStatus(`已创建包含 ${imageStates.length} 张图片的下载包`, 'success', totalOperationTime);
    } catch (e) {
        console.error("打包下载失败:", e);
        const operationEndTime = performance.now();
        const totalOperationTime = parseFloat((operationEndTime - operationStartTime).toFixed(2));
        showStatus("打包下载失败: " + e.message, 'error', totalOperationTime);
    } finally {
        globalStatus.textContent = ""; showLoading(false);
        isProcessingGlobal = false; updateButtonStates();
    }
}


// --- 清除当前图片 ---
function clearCurrentImage() {
    if (isProcessingGlobal || imageStates.length === 0 || currentFileIndex < 0) return;

    const stateToClear = imageStates[currentFileIndex];
    const clearedFilename = stateToClear.currentFilename; 

    revokeBlobUrl(stateToClear.currentBlobUrl);
    if (stateToClear.originalFile._blobUrl) { // 如果缓存了原始blob url也释放
        revokeBlobUrl(stateToClear.originalFile._blobUrl);
    }
    imageStates.splice(currentFileIndex, 1); 

    if (currentFileIndex >= imageStates.length) {
        currentFileIndex = Math.max(0, imageStates.length - 1); 
    }
    if (imageStates.length === 0) { currentFileIndex = -1; }
    
    displayCurrentImage(); updateButtonStates(); 
    showStatus(`已清除图片: ${clearedFilename}`, 'info');
}

// --- 清除全部图片 ---
function clearAllImages() {
    if (isProcessingGlobal || imageStates.length === 0) return;

    imageStates.forEach(state => {
        revokeBlobUrl(state.currentBlobUrl);
        if (state.originalFile._blobUrl) {
            revokeBlobUrl(state.originalFile._blobUrl);
        }
    });
    imageStates = []; currentFileIndex = -1; 

    displayCurrentImage(); updateButtonStates(); 
    showStatus('已清除所有图片', 'success');
}


// 在 ipt.onchange 中
ipt.onchange = () => {
    const newFiles = Array.from(ipt.files);
    if (newFiles.length === 0) return;
    const newImageStates = newFiles.map(file => {
        const originalBlobUrl = URL.createObjectURL(file); // 创建原始Blob URL
        return {
            originalFile: file,
            originalBlobUrl: originalBlobUrl, // 缓存原始Blob URL
            currentBlobUrl: originalBlobUrl,  // 初始时，当前也是原始的
            currentFilename: file.name,
            isProcessing: false
            // originalFile._blobUrl 这种下划线属性可以去掉了，我们用 state.originalBlobUrl
        };
    });
    
    imageStates = imageStates.concat(newImageStates); 
    if (currentFileIndex === -1 && imageStates.length > 0) { 
        currentFileIndex = imageStates.length - 1; // 指向最后一个新添加的
    } else if (imageStates.length > 0 && currentFileIndex === -1) {
        currentFileIndex = 0;
    } else if (newFiles.length > 0) { // 如果已有图片，并添加了新的，也指向最后一个新添加的
        currentFileIndex = imageStates.length - 1;
    }
    
    displayCurrentImage(); 
    updateButtonStates();
    ipt.value = ""; 
    showStatus(`已添加 ${newFiles.length} 张图片，共 ${imageStates.length} 张`, 'info');
};


// 绑定单张图片操作按钮的点击事件
if (btn_enc) {
    btn_enc.onclick = () => handleSingleImageOperation('encrypt');
} else {
    console.error("无法找到ID为 'enc' 的按钮进行事件绑定。");
}

if (btn_dec) {
    btn_dec.onclick = () => handleSingleImageOperation('decrypt');
} else {
    console.error("无法找到ID为 'dec' 的按钮进行事件绑定。");
}

// btn_restore.onclick 逻辑
btn_restore.onclick = () => {
    if (currentFileIndex < 0 || imageStates.length === 0) { 
        showStatus("没有可还原的图片", 'warning'); return; 
    }
    if (isProcessingGlobal) {
        showStatus("全局操作进行中，请稍候...", 'info'); return;
    }

    const state = imageStates[currentFileIndex];
    if (state.isProcessing) {
        showStatus("当前图片正在处理中，无法还原。", 'info'); return;
    }

    // 只有当 currentBlobUrl 与 originalBlobUrl 不同时才需要操作
    if (state.currentBlobUrl !== state.originalBlobUrl) {
        // 释放当前指向“处理后”图片的 Blob URL
        if (state.currentBlobUrl && state.currentBlobUrl.startsWith('blob:')) {
            revokeBlobUrl(state.currentBlobUrl);
        }
        // 将 currentBlobUrl 指回缓存的 originalBlobUrl
        state.currentBlobUrl = state.originalBlobUrl;
        state.currentFilename = state.originalFile.name;
        
        displayCurrentImage(); // 这会用 originalBlobUrl 更新 imgElement.src
        showStatus(`图片 "${state.originalFile.name.substring(0, 15)}..." 已还原`, 'success');
    } else {
        showStatus("图片已是原始状态", 'info');
    }
    updateButtonStates(); // 确保按钮状态在操作后更新
};

btn_download.onclick = () => {
    if (currentFileIndex < 0 || imageStates.length === 0) { showStatus("没有可下载的图片", 'warning'); return; }
    if (isProcessingGlobal) return;
    if (currentFileIndex >= 0 && currentFileIndex < imageStates.length) {
        const state = imageStates[currentFileIndex];
        if (state && state.currentBlobUrl && !state.isProcessing) {
            const link = document.createElement('a');
            link.href = state.currentBlobUrl;
            link.download = state.currentFilename || 'image.jpg'; 
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // 单张下载不释放blob，因为可能还要继续操作
            showStatus(`开始下载 ${state.currentFilename.substring(0, 15)}...`, 'info');
        } else {
            showStatus("当前图片无法下载", 'warning');
        }
    }
};

btn_enc_all.onclick = () => processAllImages('encrypt');
btn_dec_all.onclick = () => processAllImages('decrypt');
btn_restore_all.onclick = restoreAllImages;
btn_download_all.onclick = downloadAllImages;
btn_clear_current.onclick = clearCurrentImage;
btn_clear_all.onclick = clearAllImages;

btn_prev.onclick = () => {
    if (currentFileIndex > 0 && !isProcessingGlobal) {
        currentFileIndex--; displayCurrentImage();
        if(processingTimeInfo) processingTimeInfo.textContent = ""; // 切换图片时清除耗时
    }
};
btn_next.onclick = () => {
    if (currentFileIndex < imageStates.length - 1 && !isProcessingGlobal) {
        currentFileIndex++; displayCurrentImage();
        if(processingTimeInfo) processingTimeInfo.textContent = ""; // 切换图片时清除耗时
    }
};

window.addEventListener('beforeunload', () => {
    imageStates.forEach(state => {
        revokeBlobUrl(state.currentBlobUrl);
        if (state.originalFile._blobUrl) revokeBlobUrl(state.originalFile._blobUrl);
    });
    if(imgElement && imgElement.src && imgElement.src.startsWith('blob:')) revokeBlobUrl(imgElement.src); 
});


// ===== 弹窗功能 =====
const modal = document.getElementById('custom-modal');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const modalClose = document.getElementById('modal-close');

const modalContents = {
    help: { title: "帮助", content: "1. 上传图片：点击底部中央的+按钮，可多选图片<br>2. 混淆/解混淆：点击对应按钮<br>3. 操作全部：点击带“全部”字样的按钮<br>4. 保存图片：点击「保存」按钮<br>5. WASM加速：默认启用WASM进行处理，若加载失败则自动回退至纯JS。处理状态会显示所用模式及耗时。" },
    about: { title: "关于", content: "<center>小番茄图片批量混淆工具zip打包版</center><br>版本: 1.1.0 (WASM增强)<br>基于小番茄图片混淆进行深度修改。<br>此版本点击全部保存时将多张图打包为单个zip文件，可能能解决苹果设备不能一键保存多张的问题。<br>新增WASM加速，提升处理效率。<br><br><center>贴吧：然而他</center>" }
};

document.querySelectorAll('#settings-dropdown .menu-item').forEach(item => {
    item.addEventListener('click', function(e) {
        const settingsDropdown = document.getElementById('settings-dropdown'); 
        if (this.hasAttribute('data-modal')) {
            e.preventDefault(); 
            const modalType = this.getAttribute('data-modal');
            if (modalTitle && modalContent && modalContents[modalType]) {
                modalTitle.textContent = modalContents[modalType].title;
                modalContent.innerHTML = modalContents[modalType].content;
            } else if (modalTitle && modalContent) { 
                modalTitle.textContent = "错误";
                modalContent.innerHTML = "无法加载指定内容。";
            }
            if (modal) modal.classList.remove('hidden');
            if (settingsDropdown) {
                settingsDropdown.classList.remove('show'); settingsDropdown.classList.add('hidden');
            }
        } else {
             if (settingsDropdown) {
                setTimeout(() => { 
                    settingsDropdown.classList.remove('show'); settingsDropdown.classList.add('hidden');
                }, 50); 
            }
        }
    });
});

if (modalClose && modal) { modalClose.addEventListener('click', () => modal.classList.add('hidden')); }
if (modal) { modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); }); }
