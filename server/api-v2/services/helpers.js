const helpers = {
	capitalize(name) {
		if (typeof name != 'string') return 'invalid name value: expecting string'
		return name[0].toUpperCase() + name.slice(1).toLowerCase()
	}
}

export default helpers
