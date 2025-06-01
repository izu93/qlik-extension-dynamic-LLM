export default {
  qHyperCubeDef: {
    qDimensions: [],
    qMeasures: [],
    qInitialDataFetch: [
      {
        qWidth: 10,
        qHeight: 100,
      },
    ],
  },
  showTitles: true,
  title: "",
  subtitle: "",
  footnote: "",
  disableNavMenu: false,
  showDetails: false,
  // LLM specific properties
  props: {
    connectionName: "",
    systemPrompt: "",
    userPrompt: "",
    dynamicVariableKey: "",
    dynamicVariableValue: "",
    temperature: 0.7,
    topK: 250,
    topP: 1,
    maxTokens: 1000,
    stopTokens: "",
    font: "Arial",
    fontSize: 14,
    fontColor: {
      color: "#000000",
      index: -1,
    },
  },
};
