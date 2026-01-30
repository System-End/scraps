import { Elysia, t } from 'elysia'
import { db } from '../db'
import { usersTable } from '../schemas/users'
import { projectsTable } from '../schemas/projects'
import { sql, desc, eq } from 'drizzle-orm'

const leaderboard = new Elysia({ prefix: '/leaderboard' })

leaderboard.get('/', async ({ query }) => {
	const sortBy = query.sortBy || 'scraps'

	if (sortBy === 'hours') {
		const results = await db
			.select({
				id: usersTable.id,
				username: usersTable.username,
				avatar: usersTable.avatar,
				scraps: usersTable.scraps,
				hours: sql<number>`COALESCE(SUM(${projectsTable.hours}), 0)`.as('total_hours'),
				projectCount: sql<number>`COUNT(${projectsTable.id})`.as('project_count')
			})
			.from(usersTable)
			.leftJoin(projectsTable, eq(projectsTable.userId, usersTable.id))
			.groupBy(usersTable.id)
			.orderBy(desc(sql`total_hours`))
			.limit(10)

		return results.map((user, index) => ({
			rank: index + 1,
			id: user.id,
			username: user.username,
			avatar: user.avatar,
			hours: Number(user.hours),
			scraps: user.scraps,
			projectCount: Number(user.projectCount)
		}))
	}

	const results = await db
		.select({
			id: usersTable.id,
			username: usersTable.username,
			avatar: usersTable.avatar,
			scraps: usersTable.scraps,
			hours: sql<number>`COALESCE(SUM(${projectsTable.hours}), 0)`.as('total_hours'),
			projectCount: sql<number>`COUNT(${projectsTable.id})`.as('project_count')
		})
		.from(usersTable)
		.leftJoin(projectsTable, eq(projectsTable.userId, usersTable.id))
		.groupBy(usersTable.id)
		.orderBy(desc(usersTable.scraps))
		.limit(10)

	return results.map((user, index) => ({
		rank: index + 1,
		id: user.id,
		username: user.username,
		avatar: user.avatar,
		hours: Number(user.hours),
		scraps: user.scraps,
		projectCount: Number(user.projectCount)
	}))
}, {
	query: t.Object({
		sortBy: t.Optional(t.Union([t.Literal('hours'), t.Literal('scraps')]))
	})
})

export default leaderboard
