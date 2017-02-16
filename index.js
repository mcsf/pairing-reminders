const micro = require( 'micro' );
const { shuffle } = require( 'lodash' );
Object.assign( global, require( 'ramda' ) ); // so sue me, OK?

const {
	channelName,
	cribbsPerWeek,
	oneOnOnesPerWeek,
	teamMembers,
} = require( './config' );

const weekdays = [
	'Monday',
	'Tuesday',
	'Thursday',
	'Friday',
];

// Int -> Int
const fact = memoize( n => product( range( 1, n + 1 ) ) );

// Int -> Int -> Int
const comb = memoize( ( n, r ) => ( fact( n ) / ( fact( r ) * fact( n - r ) ) ) );

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
)

// [(a, a)] -> Bool
const isEveryoneSet = pairs => pairs.length === (
	comb( teamMembers.length, oneOnOnesPerWeek ) / 2 );

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
const timeslots = range( 11, 19 ).map( hh => `${hh}:00` );

// [a] -> a
const draw = pipe( shuffle, take( 1 ) );

// _ -> String
const reminders = pipe(
	always( weekdays ),
	shuffle,
	take( cribbsPerWeek ),
	map( day => `/remind ${channelName} Cribbs-Fonseca pairing! ${teamMembers.join( ' ' )} at ${draw( timeslots )} on ${day}` ),
	join( '\n' )
);

// _ -> String
const meetings = pipe(
	always( teamMembers ),
	allToAll,
	assignMeetings,
	map( ( [ a, b ] ) => `${a} and ${b}` ),
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
	res.writeHead( 200 );
	res.end( main() )
} );

server.listen( 3000 );
