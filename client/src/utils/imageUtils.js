/**
 * Utility for image resolution detection and High-DPI canvas template rendering.
 */

export const readImageDimensions = (file) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      return resolve({ width: 0, height: 0, isPortrait: false, isLandscape: false });
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(objectUrl);
      resolve({
        width,
        height,
        isPortrait: height >= width,
        isLandscape: width > height
      });
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image file to measure resolution."));
    };

    img.src = objectUrl;
  });
};

export const checkResolutionQuality = (width, height) => {
  if (!width || !height) {
    return {
      isFullHD: false,
      isRecommended: true,
      warningMessage: null
    };
  }

  const isPortrait = height >= width;
  let isRecommended = true;
  let isFullHD = false;
  let warningMessage = null;

  if (isPortrait) {
    // Recommended portrait: at least 1080x1920
    isFullHD = width >= 1080 && height >= 1920;
    if (width < 1080 || height < 1920) {
      isRecommended = false;
      warningMessage = "This image is below the recommended Full-HD resolution (1080×1920) and may appear blurred when viewed on mobile screens.";
    }
  } else {
    // Recommended landscape: at least 1920x1080
    isFullHD = width >= 1920 && height >= 1080;
    if (width < 1920 || height < 1080) {
      isRecommended = false;
      warningMessage = "This image is below the recommended Full-HD resolution (1920×1080) and may appear blurred.";
    }
  }

  return {
    isFullHD,
    isRecommended,
    warningMessage
  };
};

export const loadRawImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If primary image fails (e.g. 404), attempt fallback template image
      if (!src.includes("bni-template.png")) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const fallbackUrl = `${origin}/uploads/templates/bni-template.png`;
        const fallbackImg = new Image();
        fallbackImg.crossOrigin = "anonymous";
        fallbackImg.onload = () => resolve(fallbackImg);
        fallbackImg.onerror = (err) => reject(new Error(`Failed to load image from ${src}`));
        fallbackImg.src = fallbackUrl;
      } else {
        reject(new Error(`Failed to load image from ${src}`));
      }
    };
    img.src = src;
  });
};

/**
 * Render receiver text onto an image template at full high-resolution (1:1 source DPI).
 */
export const renderHighDpiInvitation = async ({ imageUrl, receiverName, designConfig }) => {
  try {
    const img = await loadRawImage(imageUrl);

    const nativeWidth = img.naturalWidth || img.width;
    const nativeHeight = img.naturalHeight || img.height;

    // Use natural resolution of the source image or at least 2x DPI scale
    const canvas = document.createElement("canvas");
    canvas.width = nativeWidth;
    canvas.height = nativeHeight;

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 1. Draw raw background image 1:1
    ctx.drawImage(img, 0, 0, nativeWidth, nativeHeight);

    if (!receiverName || !designConfig) {
      return {
        base64Image: canvas.toDataURL("image/png"),
        width: nativeWidth,
        height: nativeHeight
      };
    }

    // 2. Compute proportional layout positions
    const xPercent = designConfig.xPosition ?? 0.1;
    const yPercent = designConfig.yPosition ?? 0.565;
    const boxWidthPercent = designConfig.textBoxWidth ?? 0.8;

    const startX = xPercent * nativeWidth;
    const startY = yPercent * nativeHeight;
    const boxWidthPx = boxWidthPercent * nativeWidth;

    // Ensure web fonts (e.g. Clicker Script) are ready before rendering on Canvas
    if (typeof document !== "undefined" && document.fonts) {
      try {
        await document.fonts.ready;
      } catch (e) {
        // fallback if font ready promise fails
      }
    }

    // Standard editor reference container width is 600px
    // Calculate relative font scaling factor
    const fontScaleFactor = nativeWidth / 600;
    const baseFontSizePx = (designConfig.fontSize || 20) * fontScaleFactor;

    const fontFamily = designConfig.fontFamily || '"Clicker Script", cursive';
    const fontWeight = designConfig.fontWeight === "bold" ? "bold" : "normal";
    const textColor = designConfig.fontColour || "#000000";
    const alignment = designConfig.textAlign || designConfig.textAlignment || "center";

    // Set initial font
    let currentFontSize = baseFontSizePx;
    ctx.font = `${fontWeight} ${currentFontSize}px ${fontFamily}`;

    // Auto-scale font down if receiver name exceeds box width
    const minFontSize = 14 * fontScaleFactor;
    let textWidth = ctx.measureText(receiverName).width;
    while (textWidth > boxWidthPx && currentFontSize > minFontSize) {
      currentFontSize -= 1 * fontScaleFactor;
      ctx.font = `${fontWeight} ${currentFontSize}px ${fontFamily}`;
      textWidth = ctx.measureText(receiverName).width;
    }

    // Compute exact text alignment position
    let drawX = startX;
    if (alignment === "center") {
      // Standard box center or dead center of canvas
      if (xPercent >= 0.4 || startX + boxWidthPx / 2 > nativeWidth) {
        drawX = nativeWidth / 2;
      } else {
        drawX = startX + boxWidthPx / 2;
      }
      ctx.textAlign = "center";
    } else if (alignment === "right") {
      drawX = startX + boxWidthPx;
      ctx.textAlign = "right";
    } else {
      ctx.textAlign = "left";
    }

    ctx.textBaseline = "middle";
    ctx.fillStyle = textColor;

    // Draw receiver text
    ctx.fillText(receiverName, drawX, startY);

    // 3. Export crisp lossless PNG
    const base64Image = canvas.toDataURL("image/png");

    // 4. Generate separate 1200x630 Open Graph canvas for WhatsApp preview
    const ogCanvas = document.createElement("canvas");
    ogCanvas.width = 1200;
    ogCanvas.height = 630;
    const ogCtx = ogCanvas.getContext("2d");

    ogCtx.fillStyle = "#F8FAFC";
    ogCtx.fillRect(0, 0, 1200, 630);

    const padding = 40;
    const targetHeight = 630 - padding * 2;
    const scale = targetHeight / nativeHeight;
    const targetWidth = nativeWidth * scale;

    const dx = (1200 - targetWidth) / 2;
    const dy = padding;

    ogCtx.drawImage(canvas, dx, dy, targetWidth, targetHeight);
    const ogBase64Image = ogCanvas.toDataURL("image/jpeg", 0.85);

    return {
      base64Image,
      ogBase64Image,
      width: nativeWidth,
      height: nativeHeight
    };
  } catch (err) {
    console.warn("High-DPI rendering encountered error, allowing DOM fallback:", err.message);
    return null;
  }
};
