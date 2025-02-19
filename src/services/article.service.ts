import { ChatGroq } from '@langchain/groq';
import { GROQ_API_KEY, GROQ_MODEL } from 'astro:env/server';
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from 'node_modules/@langchain/core/dist/output_parsers';
import { RunnablePassthrough, RunnableSequence } from '@langchain/core/runnables';

const systemMessage = SystemMessagePromptTemplate.fromTemplate(`
# 🌟 Create a Comprehensive, Learner-Friendly Guide Article

Write a **detailed, engaging, and practical article** on the user-provided topic with a clear, conversational tone. The article should be designed to help fully understand and apply the topic in real-life scenarios. Use **markdown formatting** to structure the article for easy readability:

- **Headings and subheadings** (\`#\`, \`##\`, \`###\`) to organize content clearly.
- **Bullet points** (\`-\` or \`*\`) for easy-to-follow lists.
- **Emojis** (🎉, ❓, ✅) to make key points stand out and engage learners.

---

## ✨ Article Structure

### 1️⃣ Catchy Title
- Begin with an engaging, student-focused title that reflects the importance and practical use of the topic.

### 2️⃣ Introduction
- Briefly explain what the topic is, why it’s essential, and how it’s used in real life. Keep the tone friendly and motivational.

### 3️⃣ Key Concepts & Rules
- Provide a step-by-step explanation of the topic, organized into subheadings with tips.

### 4️⃣ Common Mistakes
- Highlight typical errors learners make with the topic, explaining why they happen and how to avoid them.

### 5️⃣ Detailed Comparisons
- Provide a **clear and concise comparison** with all possible related topics.

### 6️⃣ Conclusion
- Finish with a motivational note encouraging learners to use what they’ve learned in their daily communication.

---

## 🎯 Tone and Style Guidelines

- Use **clear, simple language**.
- Keep the tone **positive, encouraging, and conversational**.
- Focus on **practical application** and real-life relevance.
- Use **visual aids (tables, bullet points, emojis)** to make the content engaging and accessible.`);

const prompt = ChatPromptTemplate.fromMessages([systemMessage, HumanMessagePromptTemplate.fromTemplate('{input}')]);

const outputParser = new StringOutputParser();

const chat = new ChatGroq({
  apiKey: GROQ_API_KEY,
  model: GROQ_MODEL,
});

const pipeline = RunnableSequence.from([{ input: new RunnablePassthrough() }, prompt, chat, outputParser]);

export const getArticle = async (topic: string) => {
  return await pipeline.invoke({ input: topic });
};
