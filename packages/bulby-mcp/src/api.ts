import axios from "axios";

const API_URL = process.env.IDEAHOME_API_URL || "http://localhost:3001";

function getClient() {
  const token = process.env.IDEAHOME_TOKEN;
  if (!token) {
    throw new Error("IDEAHOME_TOKEN environment variable is missing.");
  }
  return axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getProjects() {
  const client = getClient();
  const { data } = await client.get("/projects");
  return data;
}

export async function getProjectLists(projectId: string) {
  const client = getClient();
  const [todos, ideas, features, bugs] = await Promise.all([
    client.get(`/todos?projectId=${projectId}`).then((r) => r.data),
    client.get(`/ideas?projectId=${projectId}`).then((r) => r.data),
    client.get(`/features?projectId=${projectId}`).then((r) => r.data),
    client.get(`/bugs?projectId=${projectId}`).then((r) => r.data),
  ]);
  return { todos, ideas, features, bugs };
}

export async function addItem(
  listType: "todos" | "ideas" | "features" | "bugs",
  projectId: string,
  name: string
) {
  const client = getClient();
  const { data } = await client.post(`/${listType}`, { projectId, name });
  return data;
}

export async function getBulbyMemory() {
  const client = getClient();
  const { data } = await client.get("/users/me/bulby-memory");
  return data;
}
