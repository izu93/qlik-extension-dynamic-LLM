export default function ext(galaxy) {
  console.log(
    "ext.js: Initializing LLM extension settings with galaxy",
    galaxy
  );

  return {
    definition: {
      type: "items",
      component: "accordion",
      items: {
        data: {
          uses: "data",
          items: {
            dimensions: {
              min: 0,
              max: 10,
            },
            measures: {
              min: 0,
              max: 10,
            },
          },
        },
        settings: {
          uses: "settings",
          items: {
            // LLM Configuration Section (Collapsible)
            llmConfig: {
              type: "items",
              label: "LLM Configuration",
              items: {
                connectionName: {
                  type: "string",
                  component: "dropdown",
                  label: "Connection Name",
                  ref: "props.connectionName",
                  options: [
                    { value: "", label: "Select connection..." },
                    { value: "openai-connection", label: "OpenAI Connection" },
                    { value: "claude-connection", label: "Claude Connection" },
                    { value: "custom-llm", label: "Custom LLM" },
                  ],
                  defaultValue: "",
                },
                systemPrompt: {
                  type: "string",
                  component: "textarea",
                  label: "System Prompt / Role",
                  ref: "props.systemPrompt",
                  rows: 3,
                  defaultValue: "",
                  placeholder:
                    "Optional instructions to frame the model's behavior",
                },
                userPrompt: {
                  type: "string",
                  component: "textarea",
                  label: "User Prompt / Question",
                  ref: "props.userPrompt",
                  rows: 4,
                  defaultValue: "",
                  placeholder:
                    "Main content the user wants the model to respond to",
                },
              },
            },

            // Dynamic Variables Section (Collapsible)
            dynamicVariables: {
              type: "items",
              label: "Dynamic Variables",
              items: {
                dynamicVariableKey: {
                  type: "string",
                  label: "Key",
                  ref: "props.dynamicVariableKey",
                  defaultValue: "",
                  placeholder: "Variable name (e.g., product_name)",
                },
                dynamicVariableValue: {
                  type: "string",
                  label: "Value",
                  ref: "props.dynamicVariableValue",
                  defaultValue: "",
                  placeholder: "Variable value (e.g., Wireless Headphones)",
                },
              },
            },

            // Model Parameters Section (Collapsible)
            modelParameters: {
              type: "items",
              label: "Model Parameters",
              items: {
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
                topK: {
                  type: "integer",
                  component: "slider",
                  label: "Top K",
                  ref: "props.topK",
                  min: 1,
                  max: 500,
                  step: 10,
                  defaultValue: 250,
                },
                topP: {
                  type: "number",
                  component: "slider",
                  label: "Top P",
                  ref: "props.topP",
                  min: 0,
                  max: 1,
                  step: 0.1,
                  defaultValue: 1,
                },
                maxTokens: {
                  type: "integer",
                  label: "Max Tokens",
                  ref: "props.maxTokens",
                  defaultValue: 1000,
                  min: 1,
                  max: 4000,
                },
                stopTokens: {
                  type: "string",
                  label: "Stop Tokens",
                  ref: "props.stopTokens",
                  defaultValue: "",
                  placeholder: "Comma-separated stop tokens",
                },
              },
            },

            // Advanced Options Section (Collapsible)
            advancedOptions: {
              type: "items",
              label: "Advanced Options",
              items: {
                masterItems: {
                  type: "string",
                  component: "dropdown",
                  label: "Master Items",
                  ref: "props.masterItems",
                  options: [
                    { value: "", label: "None" },
                    { value: "option1", label: "Master Item 1" },
                    { value: "option2", label: "Master Item 2" },
                  ],
                  defaultValue: "",
                },
              },
            },
          },
        },

        // Keep Appearance separate (standard Qlik section)
        appearance: {
          uses: "settings",
          items: {
            styling: {
              type: "items",
              label: "Styling",
              items: {
                font: {
                  type: "string",
                  component: "dropdown",
                  label: "Font",
                  ref: "props.font",
                  options: [
                    { value: "Arial", label: "Arial" },
                    { value: "Helvetica", label: "Helvetica" },
                    { value: "Times New Roman", label: "Times New Roman" },
                    { value: "Courier New", label: "Courier New" },
                  ],
                  defaultValue: "Arial",
                },
                fontSize: {
                  type: "integer",
                  label: "Font Size",
                  ref: "props.fontSize",
                  defaultValue: 14,
                  min: 8,
                  max: 72,
                },
                fontColor: {
                  type: "object",
                  component: "color-picker",
                  label: "Font Color",
                  ref: "props.fontColor",
                  defaultValue: {
                    color: "#000000",
                    index: -1,
                  },
                },
              },
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
}
