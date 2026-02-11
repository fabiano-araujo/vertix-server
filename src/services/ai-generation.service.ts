import axios from 'axios';
import { generateText, AVAILABLE_MODELS } from './openrouter.service';
import storageService from './storage.service';
import { prisma } from './prisma';

// ============================================
// CONFIGURATION
// ============================================

const KLING_API_KEY = process.env.KLING_API_KEY || '';
const KLING_API_URL = process.env.KLING_API_URL || 'https://api.klingai.com/v1';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Use Gemini via OpenRouter or direct API
const USE_OPENROUTER_FOR_GEMINI = process.env.USE_OPENROUTER_FOR_GEMINI === 'true';

// ============================================
// TYPES
// ============================================

export interface SeriesGenerationConfig {
  theme: string;
  genre: string;
  episodeCount: number;
  averageDuration: number; // in seconds
  targetAudience: string;
  style?: string;
  language?: string;
}

export interface GeneratedScript {
  seriesTitle: string;
  seriesDescription: string;
  episodes: EpisodeScript[];
  tags: string[];
}

export interface EpisodeScript {
  episodeNumber: number;
  title: string;
  description: string;
  scenes: SceneDescription[];
  duration: number;
}

export interface SceneDescription {
  sceneNumber: number;
  visualDescription: string;
  dialogue?: string;
  duration: number; // in seconds
  cameraMovement?: string;
  mood?: string;
}

export interface GenerationJobUpdate {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  outputData?: any;
  errorMessage?: string;
}

// ============================================
// GEMINI TEXT GENERATION
// ============================================

/**
 * Generate text using Gemini (via OpenRouter or direct API)
 */
export const generateWithGemini = async (
  prompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<string> => {
  if (USE_OPENROUTER_FOR_GEMINI) {
    // Use OpenRouter with Gemini model
    const result = await generateText(prompt, {
      model: 'google/gemini-2.0-flash-001', // Gemini 2.0 Flash via OpenRouter
      max_tokens: options.maxTokens || 8192,
      temperature: options.temperature || 0.7,
    });
    return result as string;
  } else {
    // Direct Gemini API call
    const response = await axios.post(
      `${GEMINI_API_URL}/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: options.maxTokens || 8192,
          temperature: options.temperature || 0.7,
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    return response.data.candidates[0].content.parts[0].text;
  }
};

// ============================================
// SCRIPT GENERATION
// ============================================

/**
 * Generate complete series script with Gemini
 */
export const generateSeriesScript = async (
  config: SeriesGenerationConfig
): Promise<GeneratedScript> => {
  const prompt = `
Você é um roteirista profissional de séries para plataformas de streaming vertical (estilo TikTok/Reels).

Crie um roteiro completo para uma série com as seguintes especificações:

TEMA: ${config.theme}
GÊNERO: ${config.genre}
NÚMERO DE EPISÓDIOS: ${config.episodeCount}
DURAÇÃO MÉDIA POR EPISÓDIO: ${config.averageDuration} segundos
PÚBLICO-ALVO: ${config.targetAudience}
${config.style ? `ESTILO VISUAL: ${config.style}` : ''}
IDIOMA: ${config.language || 'Português Brasileiro'}

IMPORTANTE: Cada episódio deve ser vertical (9:16), dinâmico e prender a atenção nos primeiros 3 segundos.

Responda APENAS com um JSON válido no seguinte formato (sem markdown, sem explicações):
{
  "seriesTitle": "Título da Série",
  "seriesDescription": "Descrição envolvente da série em 2-3 frases",
  "tags": ["tag1", "tag2", "tag3"],
  "episodes": [
    {
      "episodeNumber": 1,
      "title": "Título do Episódio 1",
      "description": "Descrição breve do episódio",
      "duration": ${config.averageDuration},
      "scenes": [
        {
          "sceneNumber": 1,
          "visualDescription": "Descrição detalhada do que aparece visualmente na cena",
          "dialogue": "Texto de narração ou diálogo se houver",
          "duration": 5,
          "cameraMovement": "static/pan/zoom/tracking",
          "mood": "suspense/alegre/dramático/etc"
        }
      ]
    }
  ]
}
`;

  console.log('[AI-Generation] Generating series script...');

  const result = await generateWithGemini(prompt, {
    maxTokens: 16384,
    temperature: 0.8,
  });

  // Parse JSON from response
  let cleanedResult = result.trim();

  // Remove markdown code blocks if present
  if (cleanedResult.startsWith('```json')) {
    cleanedResult = cleanedResult.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleanedResult.startsWith('```')) {
    cleanedResult = cleanedResult.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const script = JSON.parse(cleanedResult) as GeneratedScript;
    console.log(`[AI-Generation] Script generated: "${script.seriesTitle}" with ${script.episodes.length} episodes`);
    return script;
  } catch (error) {
    console.error('[AI-Generation] Failed to parse script JSON:', error);
    console.error('[AI-Generation] Raw result:', cleanedResult.substring(0, 500));
    throw new Error('Failed to parse generated script');
  }
};

// ============================================
// IMAGE GENERATION (COVERS & THUMBNAILS)
// ============================================

/**
 * Generate cover image for series using Gemini Imagen or external service
 */
export const generateCoverImage = async (
  title: string,
  genre: string,
  description: string,
  style?: string
): Promise<string> => {
  // Generate image prompt with Gemini
  const promptForImage = await generateWithGemini(`
Crie um prompt detalhado em inglês para gerar uma imagem de capa vertical (9:16) para uma série de streaming com:

Título: ${title}
Gênero: ${genre}
Descrição: ${description}
${style ? `Estilo: ${style}` : ''}

O prompt deve ser otimizado para IA de geração de imagens, com detalhes visuais específicos.
Responda APENAS com o prompt, sem explicações.
`, { temperature: 0.9 });

  console.log(`[AI-Generation] Image prompt: ${promptForImage.substring(0, 200)}...`);

  // For now, we'll use a placeholder or integrate with an image generation API
  // You can integrate with: Midjourney API, DALL-E, Stable Diffusion, etc.

  // TODO: Integrate with actual image generation API
  // Example integration with DALL-E or Stable Diffusion would go here

  // Placeholder: Return a prompt that can be used manually or with another service
  return promptForImage.trim();
};

/**
 * Generate thumbnail for episode
 */
export const generateEpisodeThumbnail = async (
  episodeTitle: string,
  visualDescription: string,
  seriesGenre: string
): Promise<string> => {
  const prompt = await generateWithGemini(`
Crie um prompt em inglês para gerar uma thumbnail vertical (9:16) para um episódio de série:

Título: ${episodeTitle}
Cena: ${visualDescription}
Gênero: ${seriesGenre}

A thumbnail deve ser chamativa e funcionar bem em tamanho pequeno.
Responda APENAS com o prompt.
`, { temperature: 0.9 });

  return prompt.trim();
};

// ============================================
// VIDEO GENERATION (KLING AI 3.0)
// ============================================

interface KlingVideoRequest {
  prompt: string;
  negative_prompt?: string;
  duration: number; // 5 or 10 seconds
  aspect_ratio: '9:16' | '16:9' | '1:1';
  mode?: 'standard' | 'professional';
  callback_url?: string;
}

interface KlingVideoResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  error?: string;
}

/**
 * Start video generation with Kling AI 3.0
 */
export const startVideoGeneration = async (
  scene: SceneDescription,
  aspectRatio: '9:16' | '16:9' | '1:1' = '9:16'
): Promise<string> => {
  // Build prompt from scene description
  const prompt = `${scene.visualDescription}. ${scene.mood ? `Mood: ${scene.mood}.` : ''} ${scene.cameraMovement ? `Camera: ${scene.cameraMovement}.` : ''}`;

  console.log(`[AI-Generation] Starting Kling video generation: ${prompt.substring(0, 100)}...`);

  try {
    const response = await axios.post<KlingVideoResponse>(
      `${KLING_API_URL}/videos/generate`,
      {
        prompt,
        negative_prompt: 'blurry, low quality, distorted, watermark, text overlay',
        duration: Math.min(scene.duration, 10), // Kling supports up to 10s per clip
        aspect_ratio: aspectRatio,
        mode: 'professional',
      } as KlingVideoRequest,
      {
        headers: {
          'Authorization': `Bearer ${KLING_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.task_id;
  } catch (error: any) {
    console.error('[AI-Generation] Kling API error:', error.response?.data || error.message);
    throw new Error(`Failed to start video generation: ${error.message}`);
  }
};

/**
 * Check video generation status
 */
export const checkVideoStatus = async (taskId: string): Promise<KlingVideoResponse> => {
  try {
    const response = await axios.get<KlingVideoResponse>(
      `${KLING_API_URL}/videos/status/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${KLING_API_KEY}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('[AI-Generation] Failed to check video status:', error.message);
    throw error;
  }
};

/**
 * Wait for video generation to complete
 */
export const waitForVideo = async (
  taskId: string,
  maxAttempts: number = 60,
  intervalMs: number = 10000
): Promise<string> => {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await checkVideoStatus(taskId);

    if (status.status === 'completed' && status.video_url) {
      return status.video_url;
    }

    if (status.status === 'failed') {
      throw new Error(`Video generation failed: ${status.error}`);
    }

    console.log(`[AI-Generation] Video generation in progress... (${i + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Video generation timed out');
};

// ============================================
// FULL SERIES GENERATION ORCHESTRATION
// ============================================

/**
 * Generate a complete series with AI (script, images, videos)
 */
export const generateFullSeries = async (
  config: SeriesGenerationConfig,
  createdById: number,
  onProgress?: (progress: number, message: string) => void
): Promise<number> => {
  const updateProgress = (progress: number, message: string) => {
    console.log(`[AI-Generation] ${progress}% - ${message}`);
    onProgress?.(progress, message);
  };

  // Create job record
  const job = await prisma.aIGenerationJob.create({
    data: {
      type: 'FULL_SERIES',
      status: 'PROCESSING',
      inputData: JSON.stringify(config),
      createdById,
      progress: 0,
    },
  });

  try {
    updateProgress(5, 'Generating series script...');

    // 1. Generate script
    const script = await generateSeriesScript(config);

    await prisma.aIGenerationJob.update({
      where: { id: job.id },
      data: { progress: 20 },
    });

    updateProgress(20, 'Creating series record...');

    // 2. Create series in database
    const series = await prisma.series.create({
      data: {
        title: script.seriesTitle,
        description: script.seriesDescription,
        coverUrl: '', // Will be updated later with generated cover
        genre: config.genre,
        tags: JSON.stringify(script.tags),
        totalEpisodes: script.episodes.length,
        createdById,
        status: 'DRAFT',
        isAiGenerated: true,
      },
    });

    await prisma.aIGenerationJob.update({
      where: { id: job.id },
      data: {
        seriesId: series.id,
        progress: 25,
      },
    });

    updateProgress(25, 'Generating cover image...');

    // 3. Generate cover image prompt (actual image generation would need integration)
    const coverPrompt = await generateCoverImage(
      script.seriesTitle,
      config.genre,
      script.seriesDescription,
      config.style
    );

    // TODO: Actually generate and upload cover image
    // For now, store the prompt in outputData

    await prisma.aIGenerationJob.update({
      where: { id: job.id },
      data: { progress: 30 },
    });

    // 4. Generate episodes
    const totalEpisodes = script.episodes.length;
    const progressPerEpisode = 60 / totalEpisodes; // 60% of progress for episodes

    for (let i = 0; i < script.episodes.length; i++) {
      const ep = script.episodes[i];
      const epProgress = 30 + (progressPerEpisode * (i + 1));

      updateProgress(Math.round(epProgress), `Generating episode ${ep.episodeNumber}...`);

      // Generate video for each scene and combine
      // For MVP, we'll create episode records with placeholder videos

      // TODO: Generate actual videos with Kling AI
      // const videoTasks = await Promise.all(
      //   ep.scenes.map(scene => startVideoGeneration(scene))
      // );

      // Create episode record
      await prisma.episode.create({
        data: {
          seriesId: series.id,
          episodeNumber: ep.episodeNumber,
          title: ep.title,
          description: ep.description,
          videoUrl: '', // Will be updated when video is ready
          duration: ep.duration,
        },
      });

      await prisma.aIGenerationJob.update({
        where: { id: job.id },
        data: { progress: Math.round(epProgress) },
      });
    }

    updateProgress(95, 'Finalizing series...');

    // 5. Update series status
    await prisma.series.update({
      where: { id: series.id },
      data: { status: 'DRAFT' }, // Keep as DRAFT until videos are ready
    });

    // 6. Complete job
    await prisma.aIGenerationJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        progress: 100,
        completedAt: new Date(),
        outputData: JSON.stringify({
          seriesId: series.id,
          script,
          coverPrompt,
        }),
      },
    });

    updateProgress(100, 'Series generation complete!');

    return series.id;
  } catch (error: any) {
    console.error('[AI-Generation] Failed to generate series:', error);

    await prisma.aIGenerationJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
      },
    });

    throw error;
  }
};

// ============================================
// JOB MANAGEMENT
// ============================================

/**
 * Get generation job status
 */
export const getJobStatus = async (jobId: number) => {
  return prisma.aIGenerationJob.findUnique({
    where: { id: jobId },
  });
};

/**
 * Get all jobs for a user
 */
export const getUserJobs = async (userId: number, limit: number = 20) => {
  return prisma.aIGenerationJob.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
};

/**
 * Cancel a pending/processing job
 */
export const cancelJob = async (jobId: number) => {
  const job = await prisma.aIGenerationJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  if (job.status !== 'PENDING' && job.status !== 'PROCESSING') {
    throw new Error('Job cannot be cancelled');
  }

  return prisma.aIGenerationJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      errorMessage: 'Cancelled by user',
    },
  });
};

// ============================================
// EXPORTS
// ============================================

export default {
  // Text generation
  generateWithGemini,
  // Script generation
  generateSeriesScript,
  // Image generation
  generateCoverImage,
  generateEpisodeThumbnail,
  // Video generation
  startVideoGeneration,
  checkVideoStatus,
  waitForVideo,
  // Full series
  generateFullSeries,
  // Job management
  getJobStatus,
  getUserJobs,
  cancelJob,
};
