// ext.js - Extension definition for property panel
export default {
  definition: {
    type: "items",
    component: "accordion", // Accordion-style property panel
    items: {
      // Standard data configuration section
      data: {
        uses: "data", // Uses built-in data configuration
      },
      // Custom LLM configuration section
      settings: {
        type: "items",
        label: "LLM Configuration",
        items: {
          // Connection name input field
          connectionName: {
            type: "string",
            label: "Connection Name",
            ref: "props.connectionName",
            defaultValue: "Churn Analytics:Anthropic_Claude35Sonnet_ChurnML",
          },
          // System prompt textarea - large character limit
          systemPrompt: {
            type: "string",
            component: "textarea",
            label: "System Prompt",
            ref: "props.systemPrompt",
            defaultValue:
              "You are an expert data scientist with knowledge of customer churn analysis. Analyze the provided customer data and provide actionable insights.",
            show: true,
            maxlength: 5000, // Large character limit
          },
          // User prompt textarea - large character limit
          userPrompt: {
            type: "string",
            component: "textarea",
            label: "User Prompt",
            ref: "props.userPrompt",
            defaultValue:
              "Based on the customer data provided, analyze the churn risk factors and provide business recommendations for retention strategies.",
            show: true,
            maxlength: 5000, // Large character limit
          },
          // Temperature slider control
          temperature: {
            type: "number",
            component: "slider",
            label: "Temperature",
            ref: "props.temperature",
            min: 0,
            max: 1,
            step: 0.1,
            defaultValue: 0.7,
          },
          // Top K parameter input
          topK: {
            type: "integer",
            label: "Top K",
            ref: "props.topK",
            defaultValue: 250,
            min: 1,
            max: 500,
          },
          // Top P parameter input
          topP: {
            type: "number",
            label: "Top P",
            ref: "props.topP",
            defaultValue: 1,
            min: 0,
            max: 1,
          },
          // Max tokens input
          maxTokens: {
            type: "integer",
            label: "Max Tokens",
            ref: "props.maxTokens",
            defaultValue: 1000,
            min: 100,
            max: 4000,
          },
        },
      },
      // Advanced Features section
      advanced: {
        type: "items",
        label: "Advanced Features",
        items: {
          // Advanced UI toggle
          showAdvancedUI: {
            type: "boolean",
            label: "Enable Advanced Chat Interface",
            ref: "props.showAdvancedUI",
            defaultValue: false,
          },
        },
      },
      // Standard appearance settings
      appearance: {
        type: "items",
        label: "Appearance",
        items: {
          // Header styling
          headerBackgroundColor: {
            type: "string",
            component: "color-picker",
            label: "Header Background Color",
            ref: "props.headerBackgroundColor",
            defaultValue: "#ffffff",
          },
          headerTextColor: {
            type: "string",
            component: "color-picker",
            label: "Header Text Color",
            ref: "props.headerTextColor",
            defaultValue: "#1a1a1a",
          },
          // Response area styling
          responseBackgroundColor: {
            type: "string",
            component: "color-picker",
            label: "Response Background Color",
            ref: "props.responseBackgroundColor",
            defaultValue: "#f8f9fa",
          },
          responseTextColor: {
            type: "string",
            component: "color-picker",
            label: "Response Text Color",
            ref: "props.responseTextColor",
            defaultValue: "#212529",
          },
          responseBorderColor: {
            type: "string",
            component: "color-picker",
            label: "Response Border Color",
            ref: "props.responseBorderColor",
            defaultValue: "#e9ecef",
          },
          // Button styling
          buttonBackgroundColor: {
            type: "string",
            component: "color-picker",
            label: "Button Background Color",
            ref: "props.buttonBackgroundColor",
            defaultValue: "#667eea",
          },
          buttonTextColor: {
            type: "string",
            component: "color-picker",
            label: "Button Text Color",
            ref: "props.buttonTextColor",
            defaultValue: "#ffffff",
          },
          // Typography and layout
          fontSize: {
            type: "integer",
            label: "Font Size",
            ref: "props.fontSize",
            defaultValue: 15,
            min: 10,
            max: 24,
          },
          textAlignment: {
            type: "string",
            component: "dropdown",
            label: "Text Alignment",
            ref: "props.textAlignment",
            options: [
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
              { value: "justify", label: "Justify" },
            ],
            defaultValue: "left",
          },
          borderRadius: {
            type: "integer",
            label: "Border Radius (px)",
            ref: "props.borderRadius",
            defaultValue: 8,
            min: 0,
            max: 20,
          },
          padding: {
            type: "integer",
            label: "Padding (px)",
            ref: "props.padding",
            defaultValue: 20,
            min: 8,
            max: 40,
          },
        },
      },
    },
  },
  // Extension support capabilities
  support: {
    snapshot: true, // Supports snapshots
    export: true, // Supports export
    exportData: false, // Doesn't support data export
  },
};
