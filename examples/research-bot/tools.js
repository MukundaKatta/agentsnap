/**
 * Three deterministic tools for the research bot.
 *
 * They return the same data for the same inputs across runs (so result_hash
 * is stable), which means any diff agentsnap surfaces is a real change in
 * the agent's behavior, not flaky external state.
 */
import { traceTool } from '../../src/index.js';

const SEARCH_INDEX = {
  rlhf: [
    {
      url: 'https://arxiv.org/abs/2203.02155',
      title: 'Training language models to follow instructions with human feedback',
      snippet:
        'InstructGPT: applies RLHF to align GPT-3 with user intent. Reward model trained on labeler comparisons; policy trained with PPO.',
    },
    {
      url: 'https://huggingface.co/blog/rlhf',
      title: 'Illustrating Reinforcement Learning from Human Feedback',
      snippet:
        'Visual explainer of the three RLHF stages: supervised fine-tuning, reward model training, and PPO optimization.',
    },
    {
      url: 'https://openai.com/research/learning-from-human-preferences',
      title: 'Learning from Human Preferences',
      snippet:
        'Earlier work on preference-based reward learning that predates the RLHF formulation used in InstructGPT.',
    },
  ],
};

const PAGE_INDEX = {
  'https://arxiv.org/abs/2203.02155':
    'We show that fine-tuning with RLHF makes a 1.3B-parameter model preferred over GPT-3 175B despite being 100x smaller. Three stages: SFT on demonstrations, reward model from comparisons, PPO against the reward model with a KL penalty to the SFT model.',
  'https://huggingface.co/blog/rlhf':
    'RLHF requires (1) a pretrained LM, (2) a labeled comparison dataset, (3) a reward model trained on those comparisons, and (4) PPO with a KL penalty so the policy stays close to the SFT initialization. The reward model is the bottleneck — it shapes everything downstream.',
  'https://openai.com/research/learning-from-human-preferences':
    'Humans were shown short clips of agent behavior and asked to pick the better one. A reward model was trained on these preferences and used to drive RL. Scales to Atari and simulated robotics with under 1% of the human time required by demonstration learning.',
};

function topicKey(query) {
  const lower = query.toLowerCase();
  for (const key of Object.keys(SEARCH_INDEX)) {
    if (lower.includes(key)) return key;
  }
  return 'rlhf';
}

export const search_web = traceTool('search_web', async ({ query }) => {
  return SEARCH_INDEX[topicKey(query)];
});

export const read_page = traceTool('read_page', async ({ url }) => {
  return { url, content: PAGE_INDEX[url] ?? `(no content for ${url})` };
});

export const save_note = traceTool('save_note', async ({ finding }) => {
  return { saved: true, finding_length: finding.length };
});

export const TOOL_SCHEMAS = [
  {
    name: 'search_web',
    description: 'Search the web for information on a topic. Returns up to 5 results with url, title, and snippet.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query.' } },
      required: ['query'],
    },
  },
  {
    name: 'read_page',
    description: 'Fetch the full text of a specific URL. Use after search_web when a snippet is not enough.',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'URL returned by search_web.' } },
      required: ['url'],
    },
  },
  {
    name: 'save_note',
    description: 'Save a single specific research finding (one fact or insight) to your notes.',
    input_schema: {
      type: 'object',
      properties: {
        finding: { type: 'string', description: 'A specific factual finding, 1-3 sentences.' },
      },
      required: ['finding'],
    },
  },
];

export const TOOL_IMPLS = { search_web, read_page, save_note };
