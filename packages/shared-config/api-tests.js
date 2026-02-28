const API_TESTS = [
  { suite: "AppController (e2e)", tests: ["GET / returns health status"] },
  { suite: "UsersController (e2e)", tests: ["GET /users returns list"] },
  {
    suite: "OrganizationsController (e2e)",
    tests: [
      "GET /organizations returns list",
      "POST /organizations creates an organization",
    ],
  },
  {
    suite: "ProjectsController (e2e)",
    tests: [
      "GET /projects returns list",
      "GET /projects?orgId= returns list filtered by org",
      "POST /projects creates a project",
      "GET /projects/:id returns a project",
      "PUT /projects/:id updates",
      "DELETE /projects/:id deletes project and its issues",
      "GET /projects/:id after delete returns 404",
    ],
  },
  {
    suite: "IssuesController (e2e)",
    tests: [
      "GET /issues returns list",
      "GET /issues?projectId= returns list filtered by project",
      "POST /issues creates an issue",
      "GET /issues/:id returns an issue",
      "PUT /issues/:id updates (no auth required)",
      "PUT /issues/:id persists automatedTest as JSON array",
      "POST /issues creates an issue with automatedTest",
      "PUT /issues/:id with token also updates",
      "PATCH /issues/:id/status persists status (for lane moves)",
      "DELETE /issues/:id deletes (no auth required)",
      "GET /issues/:id after delete returns 404",
    ],
  },
];

module.exports = { API_TESTS };
