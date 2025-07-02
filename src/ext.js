// Streamlined ext.js - Simple custom expression validation with fixed examples
// Helper function for placeholder detection
function detectPlaceholdersInPrompts(systemPrompt, userPrompt) {
  const combined = `${systemPrompt} ${userPrompt}`;
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = [...combined.matchAll(regex)];

  return matches.map((match) => ({
    placeholder: match[0],
    fieldName: match[1].trim(),
    position: match.index,
    source: match.index < systemPrompt.length ? "system" : "user",
  }));
}

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
            defaultValue: "GetSelectedCount(automl_feature)=1",
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

          // Helper text with examples - Using textarea for better display
          validationHelp: {
            type: "string",
            component: "textarea",
            label: "Expression Examples",
            ref: "props.validationHelp",
            defaultValue:
              "• Single selection: GetSelectedCount(automl_feature)=1\n• Multiple fields: GetSelectedCount(Customer)=1 and GetSelectedCount(Invoice)=1\n• With conditions: GetSelectedCount(Account)=1 and Sum(Amount) > 0\n• Multiple allowed: GetSelectedCount(Region)>=1\n• Alternative function: GetPossibleCount([FieldName])=1",
            show: function (data) {
              return data.props?.enableCustomValidation === true;
            },
            rows: 6,
            readOnly: true,
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
            show: "ℹ️ Uses external Claude SSE connection configured in data connection for advanced analysis.",
          },
          // NEW: Smart Field Mapping Button
          smartFieldMapping: {
            type: "string",
            component: "button",
            label: "🧠🔀 Smart Field Mapping",
            ref: "props.openFieldMapping",
            action: function (data) {
              // This will trigger the modal
              if (window.openSmartFieldMappingModal) {
                window.openSmartFieldMappingModal(data);
              } else {
                alert(
                  "Smart Field Mapping modal will be available in the next update."
                );
              }
            },
            show: function (data) {
              const isClaudeSelected = data.props?.connectionType === "claude";
              const hasPrompts =
                data.props?.systemPrompt || data.props?.userPrompt;
              return isClaudeSelected && hasPrompts;
            },
          },

          // NEW: Field Mapping Status Display
          fieldMappingStatus: {
            type: "string",
            component: "text",
            label: "Field Mapping Status",
            show: function (data) {
              const systemPrompt = data.props?.systemPrompt || "";
              const userPrompt = data.props?.userPrompt || "";
              const fieldMappings = data.props?.fieldMappings || [];

              if (!systemPrompt && !userPrompt) {
                return "💡 Add prompts to enable Smart Field Mapping";
              }

              const allPlaceholders = detectPlaceholdersInPrompts(
                systemPrompt,
                userPrompt
              );

              if (allPlaceholders.length === 0) {
                return "💡 Add {{field}} placeholders to use Smart Mapping";
              }

              const mappedCount = fieldMappings.filter(
                (m) => m.mappedField
              ).length;

              if (mappedCount === allPlaceholders.length) {
                return `✅ All ${allPlaceholders.length} fields mapped successfully`;
              } else {
                return `⚠️ ${allPlaceholders.length - mappedCount} of ${
                  allPlaceholders.length
                } fields need mapping`;
              }
            },
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
          // NEW: Hidden field mappings storage
          fieldMappings: {
            type: "array",
            ref: "props.fieldMappings",
            show: false, // Hidden from UI
            items: {
              placeholder: {
                type: "string",
              },
              fieldName: {
                type: "string",
              },
              mappedField: {
                type: "string",
              },
              source: {
                type: "string", // "system" or "user"
              },
            },
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
          fontSize: {
            type: "integer",
            label: "Font Size",
            ref: "props.fontSize",
            defaultValue: 14,
            min: 10,
            max: 32,
          },
          fontColor: {
            type: "string",
            component: "color-picker",
            label: "Font Color",
            ref: "props.fontColor",
            defaultValue: "#212529",
          },
          fontWeight: {
            type: "string",
            component: "dropdown",
            label: "Font Weight",
            ref: "props.fontWeight",
            options: [
              { value: "normal", label: "Normal" },
              { value: "bold", label: "Bold" },
              { value: "lighter", label: "Lighter" },
              { value: "bolder", label: "Bolder" },
            ],
            defaultValue: "normal",
          },
          fontStyle: {
            type: "string",
            component: "dropdown",
            label: "Font Style",
            ref: "props.fontStyle",
            options: [
              { value: "normal", label: "Normal" },
              { value: "italic", label: "Italic" },
              { value: "oblique", label: "Oblique" },
            ],
            defaultValue: "normal",
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
