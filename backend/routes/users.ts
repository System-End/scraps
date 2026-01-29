import { Elysia, type Context } from "elysia";

const users = new Elysia({
    prefix: "/users"
});

// users routes

users.get("/me", (ctx) => {
    
});

export default users;