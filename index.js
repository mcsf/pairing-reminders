const micro = require( 'micro' );
const { always, join, map, pipe, range, take } = require( 'ramda' );
const { shuffle } = require( 'lodash' );

const {
	channelName,
	cribbsPerWeek,
	teamMembers,
} = require( './config' );

const weekdays = [
	'Monday',
	'Tuesday',
	'Thursday',
	'Friday',
];

const timeslots = range( 11, 19 ).map( hh => `${hh}:00` );

const draw = pipe( shuffle, take( 1 ) );

const reminders = pipe(
	always( weekdays ),
	shuffle,
	take( cribbsPerWeek ),
	map( day => `/remind ${channelName} Cribbs-Fonseca pairing! ${teamMembers.join()} at ${draw(timeslots)} on ${day}` ),
	join( '\n' ) );

const server = micro( async (req, res) => {
	res.writeHead( 200 )
	res.end( reminders() )
} );

server.listen( 3000 );
