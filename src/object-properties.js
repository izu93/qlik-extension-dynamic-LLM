// object-properties.js - Streamlined configuration
export default {
  // Standard Qlik object properties
  showTitles: true,
  title: "",
  subtitle: "",
  footnote: "",

  // Hypercube definition for data handling
  qHyperCubeDef: {
    qDimensions: [], // Array to store dimension definitions
    qMeasures: [], // Array to store measure definitions
    // Initial data fetch configuration
    qInitialDataFetch: [
      {
        qWidth: 40, // Number of columns to fetch
        qHeight: 100, // Number of rows to fetch
      },
    ],
  },

  // Custom properties for streamlined LLM configuration
  props: {
    // Selection Validation
    enableCustomValidation: false, // Enable custom validation
    customValidationExpression: "", // Custom Qlik expression for validation
    customValidationMessage:
      "Please make the required selections to proceed with AI analysis", // Error message when validation fails
    validationHelp:
      "• Single selection: GetSelectedCount(automl_feature)=1\n• Multiple fields: GetSelectedCount(Customer)=1 and GetSelectedCount(Invoice)=1\n• With conditions: GetSelectedCount(Account)=1 and Sum(Amount) > 0\n• Multiple allowed: GetSelectedCount(Region)>=1\n• Alternative function: GetPossibleCount([FieldName])=1",

    // Claude-specific properties
    connectionType: "claude", // Always Claude for this streamlined version
    connectionName:
      "CSO AI Practice - Churn ML Project Workspace:Anthropic_Claude35Sonnet_ChurnML", // Claude SSE connection name
    systemPrompt: "", // System-level instructions for Claude
    userPrompt: "", // User's query/prompt for Claude with {{fieldName}} placeholders
    temperature: 0.7, // Controls randomness in responses (0-1)
    topK: 250, // Limits vocabulary to top K tokens
    topP: 1, // Nucleus sampling parameter
    maxTokens: 1000, // Maximum response length

    // Simplified styling properties - only font related
    fontSize: 14,
    fontColor: "#212529",
    fontWeight: "normal",
    fontStyle: "normal",
  },
};
