import { FastifyInstance } from 'fastify';
import searchController from '../controllers/search.controller';

export default async function searchRoutes(fastify: FastifyInstance) {
  // All search routes are public
  fastify.get('/search', searchController.search);
  fastify.get('/search/suggestions', searchController.getSuggestions);
  fastify.get('/search/trending', searchController.getTrendingSearches);
  fastify.get('/search/genres', searchController.getGenres);
}
