const micro = require( 'micro' );
const shuffleSeed = require( 'shuffle-seed' );

const {
	channelName,
	cribbsPerWeek,
	epoch,
	hoursRange,
	oneOnOnesPerWeek,
	teamMembers,
	weekdays,
} = require( './config' );

const {
	always,
	converge,
	curry,
	fromPairs,
	join,
	map,
	nth,
	pipe,
	range,
	tail,
	take,
	tap,
	unapply,
	unnest
} = require( 'ramda' );

const WEEK_IN_MS = 7 * 24 * 3600 * 1000;
const seed = Math.floor( ( Date.now() - epoch ) / WEEK_IN_MS );
let count = 0;
const shuffle = ( xs ) =>
	shuffleSeed.shuffle( xs, seed + count++ );

// [a] -> [[a]]
const tails = xs => xs.length
	? [ xs, ...tails( tail( xs ) ) ]
	: [ [] ];

// not very functional, since it implies `fn` is not referentially transparent
// (b -> Bool) -> (a -> b) -> a -> b
const retryUntil = curry( ( predicate, fn, input ) => {
	const result = fn( input );
	return predicate( result )
		? result
		: retryUntil( predicate, fn, input );
} );

// a -> [b] -> [(a, b)]
const oneToAll = ( x, ys ) => ys.map( y => [ x, y ] );

// [a] -> [(a, a)]
const allToAll = pipe(
	tails,
	map( converge( oneToAll, [ nth( 0 ), tail ] ) ),
	unnest
);

// [(a, a)] -> Bool
const isEveryoneSet = pairs => [
	Math.floor( ( teamMembers.length / 2) * oneOnOnesPerWeek ),
	pairs.length,
	1 + Math.floor( ( teamMembers.length / 2) * oneOnOnesPerWeek ),
].every( ( n, i, arr ) => ! i || ( arr[ i - 1 ] <= n ) );

// [(a, a)] -> [(a, a)]
const filterMeetings = ( pairs ) => {
	let counts = pipe(
		map( member => [ member, 0 ] ),
		fromPairs
	)( teamMembers );

	let inc = tap( member => counts[ member ]++ );

	return pairs.filter( ( [ a, b ] ) =>
		counts[ a ] < oneOnOnesPerWeek &&
		counts[ b ] < oneOnOnesPerWeek &&
		inc( a ) && inc( b ) // i'm cheating and setting state in a filter >:]
	);
};

// [(a, a)] -> [(a, a)]
const assignMeetings = retryUntil( isEveryoneSet,
	pipe( shuffle, filterMeetings ) );

// [String]
const timeslots = range( ...hoursRange ).map( hh => `${hh}:00` );

// [a] -> a
const draw = pipe( shuffle, take( 1 ) );

// _ -> String
const reminders = pipe(
	always( weekdays ),
	shuffle,
	take( cribbsPerWeek ),
	map( day => `/remind ${ channelName } Cribbs-Fonseca pairing! ${ teamMembers.join( ' ' ) } at ${ draw( timeslots ) } on ${ day }` ),
	join( '\n' )
);

// _ -> String
const meetings = pipe(
	always( teamMembers ),
	allToAll,
	assignMeetings,
	map( ( [ a, b ] ) => `${ a } and ${ b }` ),
	join( '\n' )
);

// _ -> String
const main = converge( unapply( join( '\n' ) ), [
	always( '# Slack reminders!' ),
	reminders,
	always( '' ),
	always( '# Weekly pairings!' ),
	meetings
] );

const server = micro( ( req, res ) => {
	count = 0;
	res.writeHead( 200 );
	res.end( main() )
} );

server.listen( 3000 );
