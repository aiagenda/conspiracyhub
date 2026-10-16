export const TOPICS = [
  { slug: "uap", title: "UAP & the unexplained", query: "UAP", description: "Witness accounts, public investigations and the records behind unexplained observations.", sections: ["uap", "UFOs", "ufo", "space"] },
  { slug: "surveillance", title: "Surveillance & privacy", query: "surveillance", description: "How institutions collect information, who has access and where accountability begins.", sections: ["surveillance", "privacy", "intelligence"] },
  { slug: "technology", title: "AI & technology", query: "AI", description: "The systems changing everyday life, their capabilities and the people making the decisions.", sections: ["ai", "technology", "tech"] },
  { slug: "government", title: "Power & public records", query: "government", description: "Policies, declassified documents, public spending and institutional accountability.", sections: ["politics", "government", "us-news", "uk-news", "world", "investigative"] },
  { slug: "science", title: "Science & health", query: "science", description: "Research, evidence and the limits of what a finding can establish.", sections: ["science", "health", "biotech"] },
  { slug: "environment", title: "Environment & risk", query: "environment", description: "Environmental change, public data and the decisions that shape our surroundings.", sections: ["environment", "climate", "energy"] },
] as const;

export function findTopic(slug: string) { return TOPICS.find((topic) => topic.slug === slug); }
