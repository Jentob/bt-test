import spa from "src/client/index.html";

const server = Bun.serve({
    routes: {
        "/": spa
    }
})

console.log(`Server running at ${server.url}`)