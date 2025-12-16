import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { OpenAI } from "npm:openai@4.73.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateQuestionsRequest {
  content: string;
  numberOfQuestions: number;
  userId: string;
}

interface QuestionOption {
  option_text: string;
  is_correct: boolean;
}

interface GeneratedQuestion {
  question_text: string;
  options: QuestionOption[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { content, numberOfQuestions, userId }: GenerateQuestionsRequest = await req.json();

    // Validate input
    if (!content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "El contenido no puede estar vacío" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!numberOfQuestions || numberOfQuestions < 5 || numberOfQuestions > 50) {
      return new Response(
        JSON.stringify({ error: "El número de preguntas debe estar entre 5 y 50" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Usuario no autenticado" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key no configurada" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Truncate content if too long (max ~8000 tokens ≈ 32000 characters)
    const maxContentLength = 32000;
    const truncatedContent = content.length > maxContentLength
      ? content.substring(0, maxContentLength) + "..."
      : content;

    const contentWasTruncated = content.length > maxContentLength;

    // Create prompt for OpenAI
    const systemPrompt = `Eres un experto en crear evaluaciones educativas de opción múltiple. 
Tu tarea es generar preguntas basadas en el contenido proporcionado.

Reglas importantes:
1. Genera EXACTAMENTE ${numberOfQuestions} preguntas
2. Cada pregunta debe tener EXACTAMENTE 4 opciones
3. Solo UNA opción debe ser correcta
4. Las opciones incorrectas deben ser plausibles pero claramente incorrectas
5. Varía la posición de la respuesta correcta (no siempre la opción A)
6. Las preguntas deben evaluar comprensión, no solo memorización
7. Usa español claro y profesional

Formato de respuesta (JSON):
{
  "questions": [
    {
      "question_text": "Texto de la pregunta",
      "options": [
        { "option_text": "Opción A", "is_correct": false },
        { "option_text": "Opción B", "is_correct": true },
        { "option_text": "Opción C", "is_correct": false },
        { "option_text": "Opción D", "is_correct": false }
      ]
    }
  ]
}`;

    const userPrompt = `Genera ${numberOfQuestions} preguntas de opción múltiple basadas en el siguiente contenido:

${truncatedContent}

Responde SOLO con el JSON, sin texto adicional.`;

    const startTime = Date.now();

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: numberOfQuestions * 200, // Estimate ~200 tokens per question
      response_format: { type: "json_object" },
    });

    const generationTime = Date.now() - startTime;

    // Parse response
    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      return new Response(
        JSON.stringify({ error: "No se recibió respuesta de OpenAI" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Error al parsear respuesta de OpenAI", details: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const questions: GeneratedQuestion[] = parsedResponse.questions || [];

    // Validate generated questions
    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No se generaron preguntas válidas" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate each question has exactly 4 options and one correct answer
    const validQuestions = questions.filter(q => {
      if (!q.question_text || !Array.isArray(q.options)) return false;
      if (q.options.length !== 4) return false;
      const correctCount = q.options.filter(opt => opt.is_correct).length;
      return correctCount === 1;
    });

    if (validQuestions.length === 0) {
      return new Response(
        JSON.stringify({ error: "Las preguntas generadas no cumplen con el formato requerido" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return successful response
    return new Response(
      JSON.stringify({
        success: true,
        questions: validQuestions,
        metadata: {
          questionsGenerated: validQuestions.length,
          questionsRequested: numberOfQuestions,
          tokensUsed: completion.usage?.total_tokens || 0,
          generationTimeMs: generationTime,
          contentWasTruncated,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-questions function:", error);
    return new Response(
      JSON.stringify({
        error: "Error al generar preguntas",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});