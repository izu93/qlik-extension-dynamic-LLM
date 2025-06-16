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
    // Connection type selector
    connectionType: "claude", // "claude" or "qlik-answers"

    // Claude-specific properties
    connectionName: "Churn Analytics:Anthropic_Claude35Sonnet_ChurnML", // Claude connection name
    systemPrompt: "", // System-level instructions for Claude
    userPrompt: "", // User's query/prompt for Claude
    temperature: 0.7, // Controls randomness in responses (0-1)
    topK: 250, // Limits vocabulary to top K tokens
    topP: 1, // Nucleus sampling parameter
    maxTokens: 1000, // Maximum response length

    // Qlik Answers specific properties
    qlikAnswersMode: "insight", // Analysis type for Qlik Answers
    naturalLanguageQuery: "What are the key insights from this customer data?", // Natural language query
    enableNaturalLanguage: true, // Enable natural language processing
    includeChartSuggestions: true, // Include chart suggestions in responses
    enableFollowUpQuestions: true, // Enable follow-up questions

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
