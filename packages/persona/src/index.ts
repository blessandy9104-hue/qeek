import { definePlugin } from '@deepseek-ai/dsh-core';
import { getStore } from '@zoveli/memory-store';

export type PersonaId = 'friend' | 'tutor' | 'engineer' | 'coach';

export interface PersonaDef {
  id: PersonaId;
  name: string;
  description: string;
  prompt: string;
}

/**
 * Base charter every persona carries: trusted, personal, for everyone.
 * Plain words only — this text reaches users, so technical terms stay out.
 */
export const PERSONA_BASE = `You are a trusted personal helper. Your person's privacy is absolute: their notes and words stay on their machine and are never shared. Be honest about what you can and cannot do. Serve everyone equally — never assume anyone's age, background, or ability; explain simply first, then go deeper when asked.`;

export const PERSONAS: Record<PersonaId, PersonaDef> = {
  friend: {
    id: 'friend',
    name: 'Friend',
    description: 'Everyday helper for anything (default)',
    prompt: `${PERSONA_BASE} Be warm and easy to talk to. Help with whatever the person brings — questions, notes, reminders, plans, everyday problems. Their goal is your goal: figure out what they want and help them get there.`,
  },
  tutor: {
    id: 'tutor',
    name: 'Tutor',
    description: 'Patient teacher for students of any age',
    prompt: `${PERSONA_BASE} You are a patient teacher. Explain step by step in simple words, check understanding with one question at a time, and never just hand over answers for homework — guide the student to solve it. For any math, only state answers the math tools verify. Celebrate progress.`,
  },
  engineer: {
    id: 'engineer',
    name: 'Engineer',
    description: 'Precise technical partner for builders',
    prompt: `${PERSONA_BASE} You are a precise technical partner. Be exact: show commands, code, and measurements. Review and test before declaring anything done. For any computation, only state values the math tools verify. When something is risky or destructive, say so first and wait for confirmation.`,
  },
  coach: {
    id: 'coach',
    name: 'Coach',
    description: 'Goal partner for habits and plans',
    prompt: `${PERSONA_BASE} You are a steady goal partner. Help the person name one clear goal, break it into small steps, and track progress across conversations. When they state a lasting goal or preference, save it to memory so it persists. Encourage honestly — no empty praise.`,
  },
};

export const DEFAULT_PERSONA: PersonaId = 'friend';
export const PERSONA_NOTE_TITLE = 'Persona preference';

const TUTOR_HINT = /\b(homework|exam|study|studying|assignment|school|teacher|explain simply|8th grade|eighth grade|learn)\b/i;
const ENGINEER_HINT = /\b(code|coding|debug|bug|function|repo|deploy|compile|error|traceback|pull request|refactor|API|endpoint)\b/i;
const COACH_HINT = /\b(goal|habit|routine|discipline|exercise|fitness|diet|productivity|plan my|my goal)\b/i;

function inferPersona(message: string): PersonaId {
  const text = message || '';
  if (ENGINEER_HINT.test(text)) return 'engineer';
  if (TUTOR_HINT.test(text)) return 'tutor';
  if (COACH_HINT.test(text)) return 'coach';
  return 'friend';
}

function normalizePersona(value: string): PersonaId | null {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'friend' || v === 'tutor' || v === 'engineer' || v === 'coach') return v;
  return null;
}

/** Explicit choice wins: env override, then remembered preference. */
export function readExplicitPersona(): PersonaId | null {
  const fromEnv = normalizePersona(process.env.ZOVELI_PERSONA || '');
  if (fromEnv) return fromEnv;
  try {
    const note = getStore().readNote(PERSONA_NOTE_TITLE);
    const m = note.body.match(/persona:\s*(friend|tutor|engineer|coach)/i);
    if (m) return m[1].toLowerCase() as PersonaId;
  } catch {
    // no store, no note, no preference — fall through to inference
  }
  return null;
}

/** Persist the user's persona choice to local memory. */
export function savePersonaPreference(id: PersonaId): { success: boolean; persona: PersonaId } {
  const store = getStore();
  const body = `persona: ${id}\nChosen by the user; align to it every turn until changed.`;
  try {
    store.createNote({ title: PERSONA_NOTE_TITLE, content: body, tags: ['preference'] });
  } catch {
    store.updateNote({ title: PERSONA_NOTE_TITLE, content: body, tags: ['preference'] });
  }
  return { success: true, persona: id };
}

/**
 * Resolve the persona for one turn: explicit choice (env, then memory)
 * wins; otherwise infer from the message; otherwise the default friend.
 * Pure except the best-effort preference read — never throws.
 */
export function resolvePersona(message: string, preferred?: PersonaId | null): PersonaDef {
  try {
    if (preferred) return PERSONAS[preferred];
    const explicit = readExplicitPersona();
    if (explicit) return PERSONAS[explicit];
  } catch {
    // fall through to inference
  }
  return PERSONAS[inferPersona(message)] || PERSONAS[DEFAULT_PERSONA];
}

export const zoveliPersona = definePlugin({
  name: 'zoveli-persona',
  description: 'Switchable trusted personas aligned with the user goal',

  setup(ctx) {
    ctx.provide('persona', {
      list: () => Object.values(PERSONAS).map((p) => ({ id: p.id, name: p.name, description: p.description })),
      resolve: resolvePersona,
      current: () => readExplicitPersona() || DEFAULT_PERSONA,
      switch: (id: string) => {
        const norm = normalizePersona(id);
        if (!norm) throw new Error(`unknown persona: ${id} (choose friend, tutor, engineer, or coach)`);
        return savePersonaPreference(norm);
      },
    });

    ctx.register('persona-tools', [
      {
        name: 'persona_switch',
        description: 'Switch the assistant persona (friend, tutor, engineer, coach); remembered across turns',
        parameters: {
          type: 'object',
          properties: { persona: { type: 'string', enum: ['friend', 'tutor', 'engineer', 'coach'] } },
          required: ['persona'],
        },
        async execute({ persona }: { persona: string }) {
          const norm = normalizePersona(persona);
          if (!norm) throw new Error(`unknown persona: ${persona}`);
          return savePersonaPreference(norm);
        },
      },
      {
        name: 'persona_current',
        description: 'Show the active persona and the available choices',
        parameters: { type: 'object', properties: {} },
        async execute() {
          return {
            current: readExplicitPersona() || DEFAULT_PERSONA,
            available: Object.values(PERSONAS).map((p) => ({ id: p.id, name: p.name, description: p.description })),
          };
        },
      },
    ]);
  },
});

export default zoveliPersona;
