// object-properties.js - QAE (Qlik Analytics Engine) configuration
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
        qWidth: 10, // Number of columns to fetch
        qHeight: 100, // Number of rows to fetch
      },
    ],
  },
  // Custom properties for LLM configuration
  props: {
    connectionName: "Churn Analytics:Anthropic_Claude35Sonnet_ChurnML", // Default connection
    systemPrompt:
      "You are an expert data scientist specializing in customer churn analysis and SaaS business intelligence. Focus on translating machine learning insights into actionable business recommendations for non-technical stakeholders.", // System-level instructions for the LLM
    userPrompt:
      "Based on the SHAP values provided, which features have the strongest impact on customer churn? Explain in business terms what this means. 3 bullet points for this account {AccountID}", // User's query/prompt
    temperature: 0.7, // Controls randomness in responses (0-1)
    topK: 250, // Limits vocabulary to top K tokens
    topP: 1, // Nucleus sampling parameter
    maxTokens: 1000, // Maximum response length
    // Advanced UI toggle
    showAdvancedUI: false, // Show chat interface and template features
    // Styling properties
    headerBackgroundColor: "#ffffff",
    headerTextColor: "#1a1a1a",
    responseBackgroundColor: "#f8f9fa",
    responseTextColor: "#212529",
    responseBorderColor: "#e9ecef",
    buttonBackgroundColor: "#667eea",
    buttonTextColor: "#ffffff",
    fontSize: 15,
    borderRadius: 8,
    padding: 20,
    textAlignment: "left",
  },
};
