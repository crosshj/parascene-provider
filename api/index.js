import sharp from "sharp";

const html = String.raw;

/**
 * Generates a random hex color
 */
function generateRandomColor() {
  return (
    "#" +
    Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")
  );
}

/**
 * Generates a 1024x1024 image with gradient background and circle
 * - A gradient background using random colors at each of the 4 corners
 * - A circle that is 1/3 the page size in a random color
 * @param {Object} args - Generation arguments (currently unused, reserved for future use)
 * @returns {Promise<{buffer: Buffer, color: string, width: number, height: number, colors: {corners: string[], circle: string}}>}
 */
async function generateGradientCircle(args = {}) {
  const width = 1024;
  const height = 1024;

  // Generate 4 random colors for the corners (top-left, top-right, bottom-left, bottom-right)
  const cornerColors = [
    generateRandomColor(), // top-left
    generateRandomColor(), // top-right
    generateRandomColor(), // bottom-left
    generateRandomColor(), // bottom-right
  ];

  // Generate a random color for the circle
  const circleColor = generateRandomColor();

  // Calculate circle size (1/3 of page size = radius)
  const circleRadius = Math.floor(width / 3);
  const circleCenterX = width / 2;
  const circleCenterY = height / 2;

  // Create SVG with 4-corner gradient using a simple bilinear approach
  // Top row blends top-left to top-right, bottom row blends bottom-left to bottom-right
  // Then blend vertically
  const svgBackground = html`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="topGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${cornerColors[0]}" />
          <stop offset="100%" stop-color="${cornerColors[1]}" />
        </linearGradient>
        <linearGradient id="bottomGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${cornerColors[2]}" />
          <stop offset="100%" stop-color="${cornerColors[3]}" />
        </linearGradient>
      </defs>
      <!-- Top half with top gradient -->
      <rect width="100%" height="50%" fill="url(#topGrad)" />
      <!-- Bottom half with bottom gradient -->
      <rect width="100%" height="50%" y="50%" fill="url(#bottomGrad)" />
    </svg>
  `;

  // Create circle SVG
  const circleSvg = html`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <circle
        cx="${circleCenterX}"
        cy="${circleCenterY}"
        r="${circleRadius}"
        fill="${circleColor}"
      />
    </svg>
  `;

  // Create the background with 4-corner gradient
  const backgroundBuffer = await sharp(Buffer.from(svgBackground))
    .png()
    .toBuffer();

  // Add the circle on top and return as buffer
  const imageBuffer = await sharp(backgroundBuffer)
    .composite([
      {
        input: Buffer.from(circleSvg),
        blend: "over",
      },
    ])
    .png()
    .toBuffer();

  // Return buffer and metadata including all colors used
  return {
    buffer: imageBuffer,
    color: cornerColors[0], // Primary color for backward compatibility
    width,
    height,
    colors: {
      corners: cornerColors,
      circle: circleColor,
    },
  };
}

/**
 * Escapes text for safe use in SVG
 */
function escapeSvgText(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Validates hex color format
 */
function isValidHexColor(color) {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Generates a 1024x1024 image with centered text rendered on a white background
 * @param {Object} args - Generation arguments
 * @param {string} args.text - Required text to render
 * @param {string} args.color - Optional hex color for text (defaults to black)
 * @returns {Promise<{buffer: Buffer, color: string, width: number, height: number}>}
 */
async function generateTextImage(args = {}) {
  const width = 1024;
  const height = 1024;

  // Validate required text field
  if (!args.text || typeof args.text !== "string" || args.text.trim() === "") {
    throw new Error("Text field is required and must be a non-empty string");
  }
  const text = args.text;

  // Validate and set text color
  let textColor = "#000000";
  if (args.color) {
    if (!isValidHexColor(args.color)) {
      throw new Error(
        `Invalid hex color format: ${args.color}. Must be in format #RRGGBB or #RGB`,
      );
    }
    textColor = args.color;
  }

  const backgroundColor = "#ffffff";

  // Escape text for safe SVG rendering
  const escapedText = escapeSvgText(text);

  // Create SVG with text centered - using larger font and explicit font rendering
  const svg = html`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${backgroundColor}" />
      <text
        x="50%"
        y="50%"
        font-family="Arial, Helvetica, sans-serif"
        font-size="200"
        font-weight="bold"
        fill="${textColor}"
        text-anchor="middle"
        dominant-baseline="middle"
        style="font-family: Arial, Helvetica, sans-serif;"
      >
        ${escapedText}
      </text>
    </svg>
  `;

  // Convert SVG to PNG buffer with explicit font rendering
  const imageBuffer = await sharp(Buffer.from(svg), {
    density: 300
  }).png().toBuffer();

  return {
    buffer: imageBuffer,
    color: textColor,
    width,
    height,
  };
}

// Registry of available generation methods
const generationMethods = {
  gradientCircle: {
    name: "Gradient Circle",
    description:
      "Generates a 1024x1024 image with a gradient background using random colors at each corner and a random colored circle",
    credits: 2,
    fields: {},
  },
  centeredTextOnWhite: {
    name: "Centered Text on White",
    description:
      "Generates a 1024x1024 image with centered text rendered on a white background",
    credits: 0.5,
    fields: {
      text: {
        label: "Text",
        type: "text",
        required: true,
      },
      color: {
        label: "Text Color",
        type: "color",
        required: false,
      },
    },
  },
};

// Map of method names to their generator functions
const methodHandlers = {
  gradientCircle: generateGradientCircle,
  centeredTextOnWhite: generateTextImage,
};

export default async function handler(req, res) {
  // Handle GET requests - return supported methods and their requirements
  if (req.method === "GET") {
    const capabilities = {
      status: "operational",
      last_check_at: new Date().toISOString(),
      methods: generationMethods,
    };
    return res.status(200).json(capabilities);
  }

  // Handle POST requests for image generation
  if (req.method === "POST") {
    try {
      // Parse request body
      let body;
      try {
        body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      } catch (parseError) {
        return res.status(400).json({
          error: "Invalid JSON in request body",
          message: parseError.message,
        });
      }

      // Validate method is provided
      if (!body.method) {
        return res.status(400).json({
          error: "Missing required field: method",
          available_methods: Object.keys(generationMethods),
        });
      }

      // Validate method exists
      if (!generationMethods[body.method]) {
        return res.status(400).json({
          error: `Unknown generation method: ${body.method}`,
          available_methods: Object.keys(generationMethods),
        });
      }

      // Get the method definition
      const methodDef = generationMethods[body.method];
      const args = body.args || {};

      // Validate required arguments
      const fields = methodDef.fields || {};
      const missingFields = [];
      for (const [fieldName, fieldDef] of Object.entries(fields)) {
        if (fieldDef.required && !(fieldName in args)) {
          missingFields.push(fieldName);
        }
      }

      if (missingFields.length > 0) {
        return res.status(400).json({
          error: `Missing required arguments: ${missingFields.join(", ")}`,
          method: body.method,
          missing_fields: missingFields,
        });
      }

      // Get the handler for this method
      const handler = methodHandlers[body.method];
      if (!handler) {
        return res.status(500).json({
          error: `No handler registered for method: ${body.method}`,
        });
      }

      // Generate the image using the specified method
      const result = await handler(args);

      // Return the image as PNG
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Length", result.buffer.length);
      res.setHeader("Cache-Control", "no-cache");

      // Optionally include metadata in headers
      res.setHeader("X-Image-Color", result.color);
      res.setHeader("X-Image-Width", result.width.toString());
      res.setHeader("X-Image-Height", result.height.toString());

      return res.send(result.buffer);
    } catch (error) {
      console.error("Error generating image:", error);
      return res.status(500).json({
        error: "Failed to generate image",
        message: error.message,
      });
    }
  }

  // Method not allowed
  return res.status(405).json({
    error:
      "Method not allowed. Use GET for capabilities or POST for generation.",
  });
}
