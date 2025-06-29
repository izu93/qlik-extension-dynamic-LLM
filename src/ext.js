// Streamlined ext.js - Simple custom expression validation
export default {
  definition: {
    type: "items",
    component: "accordion",
    items: {
      // Standard data configuration section
      data: {
        uses: "data",
      },

      // Selection Validation Configuration
      validation: {
        type: "items",
        label: "Selection Validation",
        items: {
          // Enable custom validation
          enableCustomValidation: {
            type: "boolean",
            label: "Enable Custom Selection Validation",
            ref: "props.enableCustomValidation",
            defaultValue: false,
          },

          // Custom expression validation
          customValidationExpression: {
            type: "string",
            component: "textarea",
            label: "Custom Validation Expression",
            ref: "props.customValidationExpression",
            defaultValue: "GetPossibleCount([FieldName])=1",
            show: function (data) {
              return data.props?.enableCustomValidation === true;
            },
            rows: 3,
          },

          customValidationMessage: {
            type: "string",
            component: "textarea",
            label: "Custom Validation Error Message",
            ref: "props.customValidationMessage",
            defaultValue:
              "Please make the required selections to proceed with AI analysis",
            show: function (data) {
              return data.props?.enableCustomValidation === true;
            },
            rows: 2,
          },

          // Helper text with examples
          validationHelp: {
            type: "string",
            component: "text",
            label: "Expression Examples",
            show: function (data) {
              return data.props?.enableCustomValidation === true;
            },
          },

          // Show examples as static text
          validationExamples: {
            type: "string",
            component: "text",
            label: "Common Patterns",
            show: function (data) {
              return data.props?.enableCustomValidation === true
                ? "• Single selection: GetPossibleCount([FieldName])=1\n" +
                    "• Two fields: GetPossibleCount([Customer])=1 and GetPossibleCount([Invoice])=1\n" +
                    "• With conditions: GetPossibleCount([Account])=1 and Sum([Amount]) > 0\n" +
                    "• Multiple allowed: GetPossibleCount([Region])>=1"
                : false;
            },
          },
        },
      },

      // LLM Configuration section
      settings: {
        type: "items",
        label: "LLM Configuration",
        items: {
          extensionVersion: {
            type: "string",
            component: "text",
            label: "Extension Version",
            show: "v3.0 - Streamlined Custom Expression",
          },
          connectionType: {
            type: "string",
            component: "dropdown",
            label: "AI Service",
            ref: "props.connectionType",
            defaultValue: "claude",
            options: [
              {
                value: "claude",
                label: "🤖 Claude 3.5 Sonnet (External Connection)",
              },
            ],
          },
          connectionName: {
            type: "string",
            label: "Claude Connection Name",
            ref: "props.connectionName",
            defaultValue:
              "CSO AI Practice - Churn ML Project Workspace:Anthropic_Claude35Sonnet_ChurnML",
            show: function (data) {
              return data.props?.connectionType === "claude";
            },
          },
          connectionInfo: {
            type: "string",
            component: "text",
            label: "Service Info",
            show: "ℹ️ Uses your external Claude SSE connection configured in QMC for advanced analysis.",
          },
          systemPrompt: {
            type: "string",
            component: "textarea",
            label: "System Prompt",
            ref: "props.systemPrompt",
            defaultValue: "",
            show: function (data) {
              const connectionType = data.props?.connectionType || "claude";
              return connectionType === "claude";
            },
            maxlength: 8000,
            rows: 6,
          },
          userPrompt: {
            type: "string",
            component: "textarea",
            label: "User Prompt",
            ref: "props.userPrompt",
            defaultValue: "",
            show: function (data) {
              const connectionType = data.props?.connectionType || "claude";
              return connectionType === "claude";
            },
            maxlength: 8000,
            rows: 6,
          },
          temperature: {
            type: "number",
            component: "slider",
            label: "Temperature",
            ref: "props.temperature",
            min: 0,
            max: 1,
            step: 0.1,
            defaultValue: 0.7,
            show: function (data) {
              const connectionType = data.props?.connectionType || "claude";
              return connectionType === "claude";
            },
          },
          topK: {
            type: "integer",
            label: "Top K",
            ref: "props.topK",
            defaultValue: 250,
            min: 1,
            max: 500,
            show: function (data) {
              const connectionType = data.props?.connectionType || "claude";
              return connectionType === "claude";
            },
          },
          topP: {
            type: "number",
            label: "Top P",
            ref: "props.topP",
            defaultValue: 1,
            min: 0,
            max: 1,
            show: function (data) {
              const connectionType = data.props?.connectionType || "claude";
              return connectionType === "claude";
            },
          },
          maxTokens: {
            type: "integer",
            label: "Max Tokens",
            ref: "props.maxTokens",
            defaultValue: 1000,
            min: 100,
            max: 4000,
            show: function (data) {
              const connectionType = data.props?.connectionType || "claude";
              return connectionType === "claude";
            },
          },
        },
      },

      // Standard appearance settings
      appearance: {
        type: "items",
        label: "Appearance",
        items: {
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
          fontSize: {
            type: "integer",
            label: "Font Size",
            ref: "props.fontSize",
            defaultValue: 12,
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
            defaultValue: 10,
            min: 5,
            max: 40,
          },
        },
      },
    },
  },
  support: {
    snapshot: true,
    export: true,
    exportData: false,
  },
};
