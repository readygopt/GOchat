import { emptyDiscoveryState, turnSchema, type DiscoveryState } from "@/lib/discovery/contract";
import type { AIProvider, TurnRequest } from "./provider";

/**
 * A deterministic stand in used only for local verification when no real provider key is
 * present. It is never the product path. It applies light heuristics so the full pipeline,
 * persistence, snapshots, recommendation and adaptation can be exercised end to end without a
 * live model. The real conversational intelligence is the configured provider (Groq by
 * default). Detection is bilingual so tests written in English still drive it, while all user
 * facing output is in European Portuguese to match the product.
 */
export class MockProvider implements AIProvider {
  readonly name = "mock";

  async generateTurn(req: TurnRequest) {
    const state: DiscoveryState = req.priorState
      ? structuredClone(req.priorState)
      : emptyDiscoveryState();

    const text = req.userMessage.toLowerCase();
    const addFact = (f: string) => {
      if (!state.confirmed_facts.includes(f)) state.confirmed_facts.push(f);
    };
    const addChannel = (c: string) => {
      if (!state.channels.includes(c)) state.channels.push(c);
    };

    // Industry cues.
    if (/(salon|salão|beauty|cabelei|barber)/.test(text)) {
      state.business.industry = "salão de beleza";
      addFact("A pessoa gere um salão de beleza.");
    }
    if (/(hotel|guest house|pousada)/.test(text)) {
      state.business.industry = "hotel";
      addFact("A pessoa gere um hotel.");
    }
    if (/(clean|limpeza)/.test(text)) {
      state.business.industry = "empresa de limpezas";
      addFact("A pessoa gere uma empresa de limpezas.");
    }

    // Channels.
    if (/instagram/.test(text)) {
      addChannel("Instagram");
      addFact("Os clientes contactam o negócio pelo Instagram.");
    }
    if (/whatsapp/.test(text)) addChannel("WhatsApp");
    if (/(phone|telefone|call|ligar)/.test(text)) addChannel("Telefone");
    if (/e ?mail/.test(text)) addChannel("Email");
    if (/(calendar|calendário|agenda)/.test(text)) {
      state.integrations = Array.from(new Set([...state.integrations, "Google Calendar"]));
    }

    // Customer intents and frequent questions.
    if (/(price|preço|prices|preços)/.test(text)) {
      pushUnique(state.frequent_questions, "Os clientes perguntam pelos preços.");
    }
    if (/(time|hora|horário|available|disponib|slot|appointment|marca)/.test(text)) {
      pushUnique(state.frequent_questions, "Os clientes perguntam pelos horários disponíveis.");
    }

    // Problem cues.
    if (/(repet|same question|answer them|responder|too many|muitas mensagens|lot of message)/.test(text)) {
      upsertPain(state, "As mensagens repetitivas consomem o tempo do proprietário.", "confirmed");
    }

    // Desired outcome.
    let wantsBooking = state.desired_capabilities.includes("marcar automaticamente");
    if (/(book|booking|appointment|schedul|agendar|marca|marcar)/.test(text)) {
      pushUnique(state.desired_capabilities, "marcar automaticamente");
      wantsBooking = true;
    }

    // Disagreement or change of mind. Adapt the recommendation.
    const disagrees = /(no,|not really|actually|prefer|instead|na verdade|prefiro|mudei de ideia|don't want|do not want|não quero)/.test(text);
    if (disagrees && /(faq|just answer|only answer|questions|só responder|apenas responder|só perguntas)/.test(text)) {
      wantsBooking = false;
      pushUnique(state.desired_capabilities, "apenas responder a perguntas");
    }

    // Confidence rises with what we know.
    state.confidence = {
      business: state.business.industry ? 0.7 : 0.3,
      problem: state.pain_points.length ? 0.7 : 0.3,
      solution: state.desired_capabilities.length ? 0.6 : 0.2,
    };

    const knowBusiness = Boolean(state.business.industry);
    const knowProblem = state.pain_points.length > 0 || state.frequent_questions.length > 0;
    const knowOutcome = state.desired_capabilities.length > 0;

    let message: string;

    if (disagrees && knowBusiness) {
      if (wantsBooking) {
        recommendBooking(state);
        message =
          "Compreendo. Como quer mesmo que os horários sejam tratados por si, um assistente de marcações continua a ser o que melhor encaixa. Responderia às perguntas comuns e também verificaria a disponibilidade e criaria a marcação assim que o cliente confirmasse. Corresponde ao que tem em mente?";
      } else {
        recommendFaq(state);
        message =
          "Isso ajuda e muda a minha sugestão. Se prefere manter os agendamentos consigo, um assistente focado em responder a perguntas sobre serviços, preços e disponibilidade seria o melhor ponto de partida, e passaria apenas o pedido de marcação para si. Faz mais sentido assim?";
      }
    } else if (knowBusiness && knowProblem && knowOutcome) {
      state.stage = "recommending";
      if (wantsBooking) recommendBooking(state);
      else recommendFaq(state);
      const rec = state.recommended_solution!;
      message = `Com base no que me contou, eu recomendaria um ${rec.type}. ${rec.summary} O passo seguinte a definir é o que deve acontecer quando um pedido sai fora do que o assistente consegue tratar. Corresponde ao tipo de solução que tinha em mente?`;
    } else if (knowBusiness && knowProblem) {
      state.stage = "understanding_process";
      message =
        "Já tenho uma imagem mais clara. Prefere que um futuro assistente apenas responda a essas perguntas e lhe passe os pedidos, ou que vá mais longe e trate ele próprio dos agendamentos?";
    } else if (knowBusiness) {
      state.stage = "understanding_problem";
      message =
        "Obrigado por dar o contexto. Quando as pessoas entram em contacto, o que procuram normalmente, e que parte disso lhe consome mais tempo?";
    } else {
      state.stage = "exploring";
      message =
        "Gostava de perceber bem a sua situação. Descreva um pouco o seu negócio e como os clientes costumam encontrar e contactar o que oferece.";
    }

    state.summary = buildSummary(state);

    const turn = turnSchema.parse({ assistant_message: message, discovery_state: state });
    return { raw: turn, turn };
  }
}

function pushUnique(arr: string[], v: string) {
  if (!arr.includes(v)) arr.push(v);
}

function upsertPain(state: DiscoveryState, textVal: string, status: "inferred" | "confirmed") {
  const existing = state.pain_points.find((p) => p.text === textVal);
  if (existing) {
    existing.status = status;
    return;
  }
  state.pain_points.push({
    text: textVal,
    evidence: "",
    impact: "",
    frequency: "",
    priority: "high",
    confidence: status === "confirmed" ? 0.8 : 0.5,
    status,
  });
}

function recommendBooking(state: DiscoveryState) {
  state.recommended_solution = {
    type: "assistente de marcações conversacional",
    summary:
      "Responderia a perguntas sobre serviços e preços, verificaria a sua disponibilidade e criaria uma marcação assim que o cliente confirmasse um horário.",
    main_problem: "O proprietário responde manualmente a perguntas repetidas e gere as marcações à mão.",
    primary_objective: "Reduzir a comunicação repetitiva e transformar contactos em marcações.",
    core_capabilities: [
      "Responder a perguntas sobre serviços",
      "Dar informação de preços",
      "Verificar disponibilidade",
      "Criar marcações",
      "Passar pedidos invulgares para um humano",
    ],
    integrations: state.integrations.length ? state.integrations : ["Google Calendar"],
    mvp: ["Informação de serviços", "Perguntas frequentes", "Disponibilidade", "Marcações", "Passagem para humano"],
    future_opportunities: ["Lembretes", "Integração com CRM", "Reativação de clientes"],
    human_handoff: "Quando um pedido é invulgar ou precisa da aprovação do proprietário.",
    why: "A conversa é sobretudo repetitiva e a parte da disponibilidade depende do calendário, por isso um assistente de marcações resolve as duas coisas de uma vez.",
  };
}

function recommendFaq(state: DiscoveryState) {
  state.recommended_solution = {
    type: "assistente de perguntas e respostas",
    summary:
      "Responderia a perguntas comuns sobre serviços, preços e disponibilidade, e passaria qualquer pedido de marcação para si confirmar.",
    main_problem: "O proprietário responde repetidamente às mesmas perguntas.",
    primary_objective: "Reduzir a comunicação repetitiva mantendo os agendamentos sob controlo humano.",
    core_capabilities: [
      "Responder a perguntas sobre serviços",
      "Dar informação de preços",
      "Partilhar horários disponíveis",
      "Recolher um pedido de marcação",
      "Passar para um humano",
    ],
    integrations: [],
    mvp: ["Informação de serviços", "Perguntas frequentes", "Recolher pedido de marcação", "Passagem para humano"],
    future_opportunities: ["Marcação automática mais tarde, se desejado"],
    human_handoff: "O proprietário confirma todas as marcações.",
    why: "A pessoa prefere manter os agendamentos consigo, por isso um assistente focado em responder encaixa melhor do que a automação total.",
  };
}

function buildSummary(state: DiscoveryState): string {
  const parts: string[] = [];
  if (state.business.industry) parts.push(`O negócio é um ${state.business.industry}.`);
  if (state.channels.length) parts.push(`Canais: ${state.channels.join(", ")}.`);
  if (state.frequent_questions.length) parts.push("Perguntas comuns registadas.");
  if (state.desired_capabilities.length)
    parts.push(`Pretende: ${state.desired_capabilities.join(", ")}.`);
  if (state.recommended_solution)
    parts.push(`Recomendação até agora: ${state.recommended_solution.type}.`);
  return parts.join(" ");
}
