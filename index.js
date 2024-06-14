const express = require('express');
const cors = require('cors');
const { ChatOpenAI } = require('@langchain/openai');
const { createStuffDocumentsChain } = require('langchain/chains/combine_documents');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { createRetrievalChain } = require('langchain/chains/retrieval');
const { createHistoryAwareRetriever } = require('langchain/chains/history_aware_retriever');
const { MessagesPlaceholder } = require('@langchain/core/prompts');
const { HumanMessage, AIMessage } = require('@langchain/core/messages');
const { TextLoader } = require('langchain/document_loaders/fs/text');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS
app.use(express.static('public')); // Serve static files from the "public" directory

// Instantiate Model
const model = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  temperature: 0.7,
});

// Logic to populate vector store
const loadDocsAndCreateVectorStore = async () => {
  const loader = new TextLoader('virtina.txt');
  const docs = await loader.load();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 100,
    chunkOverlap: 20,
  });
  const splitDocs = await splitter.splitDocuments(docs);

  const embeddings = new OpenAIEmbeddings();
  const vectorstore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);

  return vectorstore;
};

// Create the conversation chain
const createConversationChain = async (vectorstore) => {
  const retriever = vectorstore.asRetriever({ k: 2 });

  const retrieverPrompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder('chat_history'),
    ['user', '{input}'],
    [
      'user',
      'Given the above conversation, generate a search query to look up in order to get information relevant to the conversation',
    ],
  ]);

  const retrieverChain = await createHistoryAwareRetriever({
    llm: model,
    retriever,
    rephrasePrompt: retrieverPrompt,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      "Answer the user's questions based on the following context: {context}.",
    ],
    new MessagesPlaceholder('chat_history'),
    ['user', '{input}'],
  ]);

  const chain = await createStuffDocumentsChain({
    llm: model,
    prompt: prompt,
  });

  const conversationChain = await createRetrievalChain({
    combineDocsChain: chain,
    retriever: retrieverChain,
  });

  return conversationChain;
};

let conversationChain;

app.post('/chat', async (req, res) => {
    const { chatHistory, input } = req.body;
  
    if (!chatHistory || !input) {
      return res.status(400).json({ error: 'chatHistory and input are required' });
    }
  
    try {
      if (!conversationChain) {
        const vectorstore = await loadDocsAndCreateVectorStore();
        conversationChain = await createConversationChain(vectorstore);
      }
  
      const response = await conversationChain.invoke({
        chat_history: chatHistory.map((msg) =>
          msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
        ),
        input,
      });
  
      res.json({ answer: response.answer }); // Return only the answer string
    } catch (error) {
      console.error('Error processing chat:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
